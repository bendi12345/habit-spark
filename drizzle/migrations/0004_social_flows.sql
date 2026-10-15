-- Harden the existing social/duel foundation and complete the missing flows.
ALTER TABLE public.duel_challenges
  ADD COLUMN IF NOT EXISTS proof_status text NOT NULL DEFAULT 'not_submitted'
    CHECK (proof_status IN ('not_submitted', 'pending', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

DROP POLICY IF EXISTS "duelists ch" ON public.duel_challenges;
CREATE POLICY "own duel challenge details" ON public.duel_challenges
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.peer_confirmations (
  feed_id uuid NOT NULL REFERENCES public.activity_feed(id) ON DELETE CASCADE,
  confirmer uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feed_id, confirmer)
);
ALTER TABLE public.peer_confirmations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.peer_confirmations TO authenticated;
GRANT ALL ON public.peer_confirmations TO service_role;
CREATE POLICY "own peer confirmations" ON public.peer_confirmations
  FOR SELECT TO authenticated USING (auth.uid() = confirmer);

CREATE OR REPLACE FUNCTION public.my_groups()
RETURNS TABLE (id uuid, name text, invite_code text, owner uuid, member_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT g.id,g.name,g.invite_code,g.owner,count(m.user_id)::int
  FROM public.groups g JOIN public.group_members mine ON mine.group_id=g.id AND mine.user_id=auth.uid()
  JOIN public.group_members m ON m.group_id=g.id
  GROUP BY g.id ORDER BY g.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.my_duel_progress()
RETURNS TABLE (duel_id uuid,user_id uuid,progress text,flagged boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT d.id,u.id,COALESCE(
    CASE WHEN c.completed_at IS NOT NULL THEN 'accepted'
      WHEN c.proof_status='pending' THEN 'submitted'
      WHEN c.proof_status='rejected' THEN 'retry_needed'
      ELSE 'not_started' END,
    'not_started'),COALESCE(c.flagged,false)
  FROM public.duels d
  CROSS JOIN LATERAL (VALUES (d.challenger),(d.opponent)) AS u(id)
  LEFT JOIN public.duel_challenges c ON c.duel_id=d.id AND c.user_id=u.id
  WHERE auth.uid() IN (d.challenger,d.opponent)
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_balances() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('app.trusted',true) IS DISTINCT FROM 'on' THEN
    NEW.xp:=OLD.xp;
    NEW.szikra:=OLD.szikra;
    NEW.invite_code:=OLD.invite_code;
    NEW.pinned_badges:=OLD.pinned_badges;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_pinned_badges(_codes text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF cardinality(COALESCE(_codes,'{}'))>3 THEN RAISE EXCEPTION 'max 3'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(_codes,'{}')) c WHERE NOT EXISTS
    (SELECT 1 FROM public.user_badges WHERE user_id=auth.uid() AND badge_code=c))
    THEN RAISE EXCEPTION 'not owned'; END IF;
  PERFORM set_config('app.trusted','on',true);
  UPDATE public.profiles SET pinned_badges=COALESCE(_codes,'{}') WHERE id=auth.uid();
  PERFORM set_config('app.trusted','off',true);
END $$;

CREATE OR REPLACE FUNCTION public.group_leaderboard(_g uuid)
RETURNS TABLE (user_id uuid, username text, level int, streak int, score int, fields_done int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_group_member(_g,auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  RETURN QUERY
  WITH members AS (
    SELECT m.user_id, COALESCE((SELECT avg(f.difficulty)::numeric
      FROM public.fields f JOIN public.habits h ON h.id=f.habit_id
      WHERE h.user_id=m.user_id AND f.status<>'locked'),1) AS average_difficulty
    FROM public.group_members m WHERE m.group_id=_g
  ), progress AS (
    SELECT a.user_id,count(*)::int AS done,COALESCE(sum(f.difficulty)::numeric,0) AS points
    FROM public.challenge_attempts a JOIN public.fields f ON f.id=a.field_id
    WHERE a.outcome='completed' AND a.created_at>now()-interval '7 days'
      AND a.user_id IN (SELECT user_id FROM members)
    GROUP BY a.user_id
  )
  SELECT p.id,p.username,p.xp/200+1,public.user_streak(p.id),
    COALESCE(round(r.points/NULLIF(m.average_difficulty,0))::int,0),COALESCE(r.done,0)
  FROM members m JOIN public.profiles p ON p.id=m.user_id
  LEFT JOIN progress r ON r.user_id=m.user_id ORDER BY 5 DESC,6 DESC,p.username;
END $$;

-- The invite stores the challenger's own independently generated challenge.
CREATE OR REPLACE FUNCTION public.set_duel_challenge(_duel uuid,_title text,_description text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF length(trim(_title)) NOT BETWEEN 1 AND 80 OR length(trim(_description)) NOT BETWEEN 1 AND 500
    THEN RAISE EXCEPTION 'invalid challenge'; END IF;
  INSERT INTO public.duel_challenges (duel_id,user_id,title,description)
    SELECT d.id,auth.uid(),trim(_title),trim(_description) FROM public.duels d
    WHERE d.id=_duel AND d.challenger=auth.uid() AND d.status='pending'
  ON CONFLICT (duel_id,user_id) DO UPDATE
    SET title=EXCLUDED.title,description=EXCLUDED.description;
  IF NOT FOUND THEN RAISE EXCEPTION 'duel invitation not found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_duel_with_challenge(
  _opponent uuid,_days int,_difficulty int,_stake int,_title text,_description text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d uuid; recent int; w1 int; w2 int;
BEGIN
  IF _days NOT IN (1,3,7) OR _difficulty NOT BETWEEN 1 AND 10 OR _stake<0
    THEN RAISE EXCEPTION 'invalid duel settings'; END IF;
  IF length(trim(_title)) NOT BETWEEN 1 AND 80 OR length(trim(_description)) NOT BETWEEN 1 AND 500
    THEN RAISE EXCEPTION 'invalid challenge'; END IF;
  IF NOT public.are_friends(auth.uid(),_opponent) THEN RAISE EXCEPTION 'You can only duel friends'; END IF;
  IF auth.uid()::text < _opponent::text THEN
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
    PERFORM pg_advisory_xact_lock(hashtext(_opponent::text));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(_opponent::text));
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
  END IF;
  IF (SELECT count(*) FROM public.duels WHERE auth.uid() IN (challenger,opponent) AND status IN ('pending','active'))>=3
    THEN RAISE EXCEPTION 'Max 3 active duels'; END IF;
  IF _stake>public.stake_cap(auth.uid(),_opponent) THEN RAISE EXCEPTION 'Stake is above the allowed cap (%)',public.stake_cap(auth.uid(),_opponent); END IF;
  SELECT count(*),count(*) FILTER (WHERE r.winner=auth.uid()),count(*) FILTER (WHERE r.winner=_opponent)
    INTO recent,w1,w2 FROM public.duel_results r JOIN public.duels x ON x.id=r.duel_id
    WHERE r.decided_at>now()-interval '14 days'
      AND ((x.challenger=auth.uid() AND x.opponent=_opponent) OR (x.challenger=_opponent AND x.opponent=auth.uid()))
      AND r.outcome='win';
  IF recent>=4 AND abs(w1-w2)<=1 THEN RAISE EXCEPTION 'Duels between you two are paused for a while (unusual win pattern)'; END IF;
  INSERT INTO public.duels (challenger,opponent,duration_days,target_difficulty,stake,awaiting)
    VALUES (auth.uid(),_opponent,_days,_difficulty,_stake,_opponent) RETURNING id INTO d;
  INSERT INTO public.duel_challenges (duel_id,user_id,title,description)
    VALUES (d,auth.uid(),trim(_title),trim(_description));
  RETURN d;
END $$;

-- Acceptance, both escrow debits, challenge insertions, and activation are atomic.
CREATE OR REPLACE FUNCTION public.accept_duel_with_challenge(
  _duel uuid,_title text,_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x public.duels;
BEGIN
  SELECT * INTO x FROM public.duels
    WHERE id=_duel AND status='pending' AND awaiting=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not your turn'; END IF;
  IF (SELECT count(*) FROM public.duels
      WHERE auth.uid() IN (challenger,opponent) AND status IN ('pending','active')) > 3
    THEN RAISE EXCEPTION 'Max 3 active duels'; END IF;
  IF length(trim(_title)) NOT BETWEEN 1 AND 80 OR length(trim(_description)) NOT BETWEEN 1 AND 500
    THEN RAISE EXCEPTION 'invalid challenge'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.duel_challenges WHERE duel_id=_duel AND user_id=x.challenger)
    THEN RAISE EXCEPTION 'challenger challenge is missing'; END IF;
  IF x.stake>0 THEN
    IF x.stake>public.stake_cap(x.challenger,x.opponent) THEN RAISE EXCEPTION 'Stake is no longer allowed by the cap'; END IF;
    PERFORM public._grant(x.challenger,-x.stake,0,'Duel stake (escrow)','escrow');
    PERFORM public._grant(x.opponent,-x.stake,0,'Duel stake (escrow)','escrow');
    INSERT INTO public.duel_escrow (duel_id,user_id,amount)
      VALUES (_duel,x.challenger,x.stake),(_duel,x.opponent,x.stake);
  END IF;
  INSERT INTO public.duel_challenges (duel_id,user_id,title,description)
    VALUES (_duel,auth.uid(),trim(_title),trim(_description));
  UPDATE public.duels SET status='active',awaiting=NULL,starts_at=now(),
    ends_at=now()+make_interval(days=>x.duration_days) WHERE id=_duel;
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.accept_duel(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_duel(uuid,int,int,int) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_duel_challenge(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_duel_with_challenge(uuid,int,int,int,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_duel_with_challenge(uuid,text,text) TO authenticated;

-- Submission is private and pending until the trusted proof-review Edge Function
-- calls review_duel_proof using service_role. No client can settle a wager.
CREATE OR REPLACE FUNCTION public.complete_duel_challenge(_duel uuid,_proof text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_duelist(_duel,auth.uid()) THEN RAISE EXCEPTION 'not a participant'; END IF;
  IF length(trim(coalesce(_proof,'')))<10 THEN
    RAISE EXCEPTION 'Please describe how you did it (at least a sentence)';
  END IF;
  UPDATE public.duel_challenges c SET proof=left(trim(_proof),1000),proof_status='pending',submitted_at=now()
  FROM public.duels d WHERE c.duel_id=_duel AND c.user_id=auth.uid() AND c.completed_at IS NULL
    AND d.id=c.duel_id AND d.status='active' AND d.ends_at>=now();
  IF NOT FOUND THEN RAISE EXCEPTION 'duel inactive or proof already submitted'; END IF;
  RETURN jsonb_build_object('result','pending_review');
END $$;

CREATE OR REPLACE FUNCTION public.review_duel_proof(_duel uuid,_proof_owner uuid,_approved boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x public.duels; earliest uuid; pending_earlier boolean;
BEGIN
  SELECT * INTO x FROM public.duels WHERE id=_duel FOR UPDATE;
  IF NOT FOUND OR x.status<>'active' OR _proof_owner NOT IN (x.challenger,x.opponent)
    THEN RAISE EXCEPTION 'duel is not reviewable'; END IF;
  UPDATE public.duel_challenges SET proof_status=CASE WHEN _approved THEN 'accepted' ELSE 'rejected' END,
    completed_at=CASE WHEN _approved THEN submitted_at ELSE NULL END
    WHERE duel_id=_duel AND user_id=_proof_owner AND proof_status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'no pending proof'; END IF;
  IF _approved THEN
    SELECT user_id INTO earliest FROM public.duel_challenges
      WHERE duel_id=_duel AND proof_status='accepted' ORDER BY submitted_at,user_id LIMIT 1;
    SELECT EXISTS (SELECT 1 FROM public.duel_challenges
      WHERE duel_id=_duel AND proof_status='pending' AND submitted_at<
        (SELECT submitted_at FROM public.duel_challenges WHERE duel_id=_duel AND user_id=earliest))
      INTO pending_earlier;
    IF NOT pending_earlier THEN
      PERFORM public._settle_duel(_duel,earliest);
      RETURN jsonb_build_object('proof_accepted',true,'settled',true,'winner',earliest);
    END IF;
  ELSE
    SELECT user_id INTO earliest FROM public.duel_challenges
      WHERE duel_id=_duel AND proof_status='accepted' ORDER BY submitted_at,user_id LIMIT 1;
    IF earliest IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.duel_challenges
      WHERE duel_id=_duel AND proof_status='pending' AND submitted_at<
        (SELECT submitted_at FROM public.duel_challenges WHERE duel_id=_duel AND user_id=earliest))
      THEN
        PERFORM public._settle_duel(_duel,earliest);
        RETURN jsonb_build_object('proof_accepted',false,'settled',true,'winner',earliest);
      END IF;
  END IF;
  RETURN jsonb_build_object('proof_accepted',_approved,'settled',false,'winner',NULL);
END $$;
REVOKE ALL ON FUNCTION public.review_duel_proof(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_duel_proof(uuid,uuid,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.create_duel_with_challenge(uuid,int,int,int,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accept_duel_with_challenge(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.my_duel_progress() FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION public.confirm_group_proof(_feed uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.activity_feed
    WHERE id=_feed AND kind IN ('field','checkpoint');
  IF owner IS NULL OR owner=auth.uid() THEN RAISE EXCEPTION 'proof cannot be confirmed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members a JOIN public.group_members b
    ON a.group_id=b.group_id WHERE a.user_id=auth.uid() AND b.user_id=owner)
    THEN RAISE EXCEPTION 'not in a shared group'; END IF;
  INSERT INTO public.peer_confirmations (feed_id,confirmer) VALUES (_feed,auth.uid()) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.flag_duel_proof(_duel uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.duel_challenges SET flagged=true
  WHERE duel_id=_duel AND user_id<>auth.uid() AND proof_status IN ('pending','accepted')
    AND public.is_duelist(_duel,auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'no opponent proof to flag'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.expire_duel(_duel uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE winner uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.duels WHERE id=_duel
    AND auth.uid() IN (challenger,opponent) AND status='active' AND ends_at<now()) THEN
    RAISE EXCEPTION 'duel has not expired';
  END IF;
  IF EXISTS (SELECT 1 FROM public.duel_challenges WHERE duel_id=_duel AND proof_status='pending') THEN
    RETURN;
  END IF;
  SELECT user_id INTO winner FROM public.duel_challenges
    WHERE duel_id=_duel AND proof_status='accepted' ORDER BY submitted_at,user_id LIMIT 1;
  PERFORM public._settle_duel(_duel,winner);
END $$;

GRANT EXECUTE ON FUNCTION public.create_duel_with_challenge(uuid,int,int,int,text,text),public.accept_duel_with_challenge(uuid,text,text),
  public.my_groups(),public.my_duel_progress(),public.confirm_group_proof(uuid),public.flag_duel_proof(uuid),public.expire_duel(uuid) TO authenticated;
