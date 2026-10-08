
-- PROFILE EXTENSIONS
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_code text UNIQUE DEFAULT upper(substr(md5(random()::text),1,6)),
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS szikra integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pinned_badges text[] NOT NULL DEFAULT '{}';
UPDATE public.profiles SET invite_code = upper(substr(md5(random()::text||id::text),1,6)) WHERE invite_code IS NULL;
UPDATE public.profiles SET username = 'user' || substr(replace(id::text,'-',''),1,6) WHERE username IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
          'user' || substr(replace(NEW.id::text,'-',''),1,6))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

-- Prevent clients from editing balances directly
CREATE OR REPLACE FUNCTION public.protect_profile_balances() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('app.trusted', true) IS DISTINCT FROM 'on' THEN
    NEW.xp := OLD.xp; NEW.szikra := OLD.szikra; NEW.invite_code := OLD.invite_code;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_profile_balances ON public.profiles;
CREATE TRIGGER protect_profile_balances BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_balances();

-- LEDGER
CREATE TABLE public.szikra_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  kind text NOT NULL DEFAULT 'earn',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.szikra_ledger TO authenticated;
GRANT ALL ON public.szikra_ledger TO service_role;
ALTER TABLE public.szikra_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger" ON public.szikra_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- BADGES
CREATE TABLE public.badges (
  code text PRIMARY KEY, name text NOT NULL, description text NOT NULL, category text NOT NULL,
  rarity text NOT NULL, hidden boolean NOT NULL DEFAULT false, sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read badges" ON public.badges FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, badge_code text NOT NULL, label text, count int NOT NULL DEFAULT 1,
  earned_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, badge_code, label)
);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own badges" ON public.user_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- SHOP
CREATE TABLE public.shop_items (
  code text PRIMARY KEY, name text NOT NULL, description text NOT NULL, category text NOT NULL,
  price int NOT NULL, monthly_limit int, emoji text NOT NULL DEFAULT '✨', sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read shop" ON public.shop_items FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, item_code text NOT NULL,
  used boolean NOT NULL DEFAULT false, purchased_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_items TO authenticated;
GRANT ALL ON public.user_items TO service_role;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items" ON public.user_items FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.custom_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL, price int NOT NULL CHECK (price BETWEEN 1 AND 100000),
  claimed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.custom_rewards TO authenticated;
GRANT ALL ON public.custom_rewards TO service_role;
ALTER TABLE public.custom_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rewards select" ON public.custom_rewards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own rewards insert" ON public.custom_rewards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND claimed_at IS NULL);
CREATE POLICY "own rewards delete" ON public.custom_rewards FOR DELETE TO authenticated USING (auth.uid() = user_id AND claimed_at IS NULL);

CREATE TABLE public.growth_programs (
  code text PRIMARY KEY, name text NOT NULL, description text NOT NULL, price int NOT NULL, emoji text NOT NULL
);
GRANT SELECT ON public.growth_programs TO authenticated;
GRANT ALL ON public.growth_programs TO service_role;
ALTER TABLE public.growth_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read programs" ON public.growth_programs FOR SELECT TO authenticated USING (true);

-- SOCIAL
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requester uuid NOT NULL, addressee uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester, addressee), CHECK (requester <> addressee)
);
GRANT SELECT ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own friendships" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() IN (requester, addressee));

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, owner uuid NOT NULL,
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text),1,6)), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE, user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (group_id, user_id)
);
GRANT SELECT ON public.groups, public.group_members TO authenticated;
GRANT ALL ON public.groups, public.group_members TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_group_member(_g uuid, _u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id=_g AND user_id=_u) $$;
CREATE POLICY "member groups" ON public.groups FOR SELECT TO authenticated USING (public.is_group_member(id, auth.uid()));
CREATE POLICY "member rows" ON public.group_members FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));

CREATE TABLE public.activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, kind text NOT NULL, text text NOT NULL,
  cheers int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.feed_cheers (feed_id uuid NOT NULL REFERENCES public.activity_feed(id) ON DELETE CASCADE, user_id uuid NOT NULL, emoji text NOT NULL DEFAULT '👏', PRIMARY KEY(feed_id, user_id));
GRANT SELECT ON public.activity_feed, public.feed_cheers TO authenticated;
GRANT ALL ON public.activity_feed, public.feed_cheers TO service_role;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_cheers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feed" ON public.activity_feed FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own cheers" ON public.feed_cheers FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- DUELS
CREATE TABLE public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), challenger uuid NOT NULL, opponent uuid NOT NULL,
  duration_days int NOT NULL CHECK (duration_days IN (1,3,7)), target_difficulty int NOT NULL CHECK (target_difficulty BETWEEN 1 AND 10),
  stake int NOT NULL DEFAULT 0 CHECK (stake >= 0), awaiting uuid, status text NOT NULL DEFAULT 'pending',
  starts_at timestamptz, ends_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.duel_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '', proof text,
  completed_at timestamptz, flagged boolean NOT NULL DEFAULT false, UNIQUE (duel_id, user_id)
);
CREATE TABLE public.duel_escrow (
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE, user_id uuid NOT NULL, amount int NOT NULL,
  released boolean NOT NULL DEFAULT false, PRIMARY KEY (duel_id, user_id)
);
CREATE TABLE public.duel_results (
  duel_id uuid PRIMARY KEY REFERENCES public.duels(id) ON DELETE CASCADE, winner uuid, loser uuid,
  outcome text NOT NULL, pot int NOT NULL DEFAULT 0, decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.duel_badges (
  winner uuid NOT NULL, loser uuid NOT NULL, wins int NOT NULL DEFAULT 1, last_earned timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (winner, loser)
);
GRANT SELECT ON public.duels, public.duel_challenges, public.duel_escrow, public.duel_results, public.duel_badges TO authenticated;
GRANT ALL ON public.duels, public.duel_challenges, public.duel_escrow, public.duel_results, public.duel_badges TO service_role;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_badges ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_duelist(_d uuid, _u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM duels WHERE id=_d AND _u IN (challenger, opponent)) $$;
CREATE POLICY "duelists" ON public.duels FOR SELECT TO authenticated USING (auth.uid() IN (challenger, opponent));
CREATE POLICY "duelists ch" ON public.duel_challenges FOR SELECT TO authenticated USING (public.is_duelist(duel_id, auth.uid()));
CREATE POLICY "own escrow" ON public.duel_escrow FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "duelists res" ON public.duel_results FOR SELECT TO authenticated USING (public.is_duelist(duel_id, auth.uid()));
CREATE POLICY "own duel badges" ON public.duel_badges FOR SELECT TO authenticated USING (auth.uid() IN (winner, loser));

-- CORE HELPERS
CREATE OR REPLACE FUNCTION public._grant(_u uuid, _szikra int, _xp int, _reason text, _kind text DEFAULT 'earn') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM set_config('app.trusted','on',true);
  UPDATE profiles SET szikra = szikra + _szikra, xp = xp + GREATEST(_xp,0) WHERE id = _u;
  IF (SELECT szikra FROM profiles WHERE id=_u) < 0 THEN RAISE EXCEPTION 'insufficient Szikra'; END IF;
  INSERT INTO szikra_ledger (user_id, amount, xp, reason, kind) VALUES (_u, _szikra, GREATEST(_xp,0), _reason, _kind);
  PERFORM set_config('app.trusted','off',true);
END $$;
REVOKE ALL ON FUNCTION public._grant(uuid,int,int,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._award_badge(_u uuid, _code text, _label text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_badges WHERE user_id=_u AND badge_code=_code AND label IS NOT DISTINCT FROM _label) THEN
    IF _label IS NOT NULL THEN UPDATE user_badges SET count = count + 1, earned_at = now() WHERE user_id=_u AND badge_code=_code AND label=_label; RETURN true; END IF;
    RETURN false;
  END IF;
  INSERT INTO user_badges (user_id, badge_code, label) VALUES (_u, _code, _label);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public._award_badge(uuid,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reward_for(_difficulty int, _checkpoint boolean) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('szikra', _difficulty * 2 + CASE WHEN _checkpoint THEN 25 ELSE 0 END,
                            'xp', _difficulty * 10 + CASE WHEN _checkpoint THEN 50 ELSE 0 END) $$;

CREATE OR REPLACE FUNCTION public.user_streak(_u uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH d AS (SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Budapest')::date AS day FROM challenge_attempts WHERE user_id=_u AND outcome='completed'),
  r AS (SELECT day, day - (row_number() OVER (ORDER BY day))::int AS grp FROM d)
  SELECT COALESCE((SELECT count(*)::int FROM r WHERE grp = (SELECT grp FROM r WHERE day >= (now() AT TIME ZONE 'Europe/Budapest')::date - 1 ORDER BY day DESC LIMIT 1)), 0) $$;

-- COMPLETE FIELD with rewards
CREATE OR REPLACE FUNCTION public.complete_field(_habit uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE h habits; f fields; rw jsonb; sz int; xpv int; easy_today int; badges_new text[] := '{}'; before_lvl int; after_lvl int; total int; streak int; had_today boolean;
BEGIN
  SELECT * INTO h FROM habits WHERE id = _habit AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  IF h.paused_until IS NOT NULL AND h.paused_until > now() THEN RAISE EXCEPTION 'paused'; END IF;
  SELECT * INTO f FROM fields WHERE habit_id = _habit AND position = h.current_position;
  IF NOT FOUND THEN RAISE EXCEPTION 'no current field'; END IF;
  had_today := EXISTS (SELECT 1 FROM challenge_attempts WHERE user_id=auth.uid() AND outcome='completed' AND (created_at AT TIME ZONE 'Europe/Budapest')::date = (now() AT TIME ZONE 'Europe/Budapest')::date);
  UPDATE fields SET status = 'completed' WHERE id = f.id;
  INSERT INTO challenge_attempts (field_id, habit_id, user_id, outcome) VALUES (f.id, _habit, auth.uid(), 'completed');
  UPDATE fields SET status = 'current' WHERE habit_id = _habit AND position = h.current_position + 1;
  UPDATE habits SET current_position = h.current_position + 1, consecutive_failures = 0, paused_until = NULL,
    last_checkpoint = CASE WHEN f.is_checkpoint THEN f.position ELSE last_checkpoint END WHERE id = _habit;

  rw := reward_for(f.difficulty, f.is_checkpoint);
  sz := (rw->>'szikra')::int; xpv := (rw->>'xp')::int;
  IF f.difficulty <= 3 AND NOT f.is_checkpoint THEN
    SELECT COALESCE(sum(amount),0) INTO easy_today FROM szikra_ledger WHERE user_id=auth.uid() AND reason LIKE 'Easy field%' AND created_at > now() - interval '1 day';
    sz := GREATEST(0, LEAST(sz, 20 - easy_today));
  END IF;
  SELECT xp / 200 + 1 INTO before_lvl FROM profiles WHERE id = auth.uid();
  PERFORM _grant(auth.uid(), sz, xpv, CASE WHEN f.difficulty <= 3 AND NOT f.is_checkpoint THEN 'Easy field ' ELSE 'Field ' END || f.position || ': ' || f.title);
  IF NOT had_today THEN
    streak := user_streak(auth.uid());
    PERFORM _grant(auth.uid(), 5, 10, 'Streak day ' || streak);
    IF streak IN (1,3,7,14,30,60,100) AND _award_badge(auth.uid(), 'clean_' || streak) THEN badges_new := badges_new || ('clean_' || streak); END IF;
  END IF;
  SELECT count(*) INTO total FROM challenge_attempts WHERE user_id=auth.uid() AND outcome='completed';
  IF total = 1 AND _award_badge(auth.uid(), 'first_step') THEN badges_new := badges_new || 'first_step'::text; END IF;
  IF f.is_checkpoint AND f.position IN (5,25,50,100) AND _award_badge(auth.uid(), 'field_' || f.position) THEN badges_new := badges_new || ('field_' || f.position); END IF;
  SELECT xp / 200 + 1 INTO after_lvl FROM profiles WHERE id = auth.uid();
  IF after_lvl >= 5 AND before_lvl < 5 AND _award_badge(auth.uid(), 'level_5') THEN badges_new := badges_new || 'level_5'::text; END IF;
  IF after_lvl >= 10 AND before_lvl < 10 AND _award_badge(auth.uid(), 'level_10') THEN badges_new := badges_new || 'level_10'::text; END IF;
  INSERT INTO activity_feed (user_id, kind, text) VALUES (auth.uid(), CASE WHEN f.is_checkpoint THEN 'checkpoint' ELSE 'field' END,
    CASE WHEN f.is_checkpoint THEN 'reached checkpoint ' || f.position ELSE 'completed field ' || f.position END);
  RETURN jsonb_build_object('checkpoint', f.is_checkpoint, 'position', f.position, 'szikra', sz, 'xp', xpv,
    'streak_bonus', NOT had_today, 'level_up', after_lvl > before_lvl, 'level', after_lvl, 'badges', to_jsonb(badges_new));
END $$;

-- SHOP
CREATE OR REPLACE FUNCTION public.buy_item(_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it shop_items; n int;
BEGIN
  SELECT * INTO it FROM shop_items WHERE code = _code; IF NOT FOUND THEN RAISE EXCEPTION 'no such item'; END IF;
  IF it.monthly_limit IS NULL AND EXISTS (SELECT 1 FROM user_items WHERE user_id=auth.uid() AND item_code=_code) THEN RAISE EXCEPTION 'already owned'; END IF;
  IF it.monthly_limit IS NOT NULL THEN
    SELECT count(*) INTO n FROM user_items WHERE user_id=auth.uid() AND item_code=_code AND purchased_at > date_trunc('month', now());
    IF n >= it.monthly_limit THEN RAISE EXCEPTION 'monthly limit reached'; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
  PERFORM _grant(auth.uid(), -it.price, 0, 'Bought: ' || it.name, 'spend');
  INSERT INTO user_items (user_id, item_code) VALUES (auth.uid(), _code);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.redeem_reward(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r custom_rewards;
BEGIN
  SELECT * INTO r FROM custom_rewards WHERE id=_id AND user_id=auth.uid() AND claimed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reward not found'; END IF;
  PERFORM _grant(auth.uid(), -r.price, 0, 'Reward: ' || r.title, 'spend');
  UPDATE custom_rewards SET claimed_at = now() WHERE id=_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.set_pinned_badges(_codes text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF array_length(_codes,1) > 3 THEN RAISE EXCEPTION 'max 3'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_codes) c WHERE NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id=auth.uid() AND badge_code=c)) THEN RAISE EXCEPTION 'not owned'; END IF;
  UPDATE profiles SET pinned_badges = COALESCE(_codes,'{}') WHERE id = auth.uid();
END $$;

-- FRIENDS
CREATE OR REPLACE FUNCTION public.add_friend(_handle text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE target uuid;
BEGIN
  SELECT id INTO target FROM profiles WHERE lower(username) = lower(trim(_handle)) OR invite_code = upper(trim(_handle)) LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'No one found with that username or code'; END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'That''s you!'; END IF;
  IF EXISTS (SELECT 1 FROM friendships WHERE requester=target AND addressee=auth.uid() AND status='pending') THEN
    UPDATE friendships SET status='accepted' WHERE requester=target AND addressee=auth.uid();
    RETURN jsonb_build_object('status','accepted');
  END IF;
  INSERT INTO friendships (requester, addressee) VALUES (auth.uid(), target) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('status','pending');
END $$;

CREATE OR REPLACE FUNCTION public.respond_friend(_id uuid, _accept boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _accept THEN UPDATE friendships SET status='accepted' WHERE id=_id AND addressee=auth.uid() AND status='pending';
  ELSE DELETE FROM friendships WHERE id=_id AND auth.uid() IN (requester, addressee); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM friendships WHERE status='accepted' AND ((requester=_a AND addressee=_b) OR (requester=_b AND addressee=_a))) $$;

CREATE OR REPLACE FUNCTION public.friend_list() RETURNS TABLE (friendship_id uuid, user_id uuid, username text, display_name text, level int, streak int, pinned_badges text[], status text, incoming boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT f.id, p.id, p.username, p.display_name, p.xp/200+1,
    CASE WHEN f.status='accepted' THEN user_streak(p.id) ELSE 0 END,
    CASE WHEN f.status='accepted' THEN p.pinned_badges ELSE '{}'::text[] END, f.status, f.addressee = auth.uid()
  FROM friendships f JOIN profiles p ON p.id = CASE WHEN f.requester = auth.uid() THEN f.addressee ELSE f.requester END
  WHERE auth.uid() IN (f.requester, f.addressee) ORDER BY f.status, p.username $$;

-- GROUPS
CREATE OR REPLACE FUNCTION public.create_group(_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g uuid;
BEGIN
  IF length(trim(_name)) < 2 THEN RAISE EXCEPTION 'name too short'; END IF;
  INSERT INTO groups (name, owner) VALUES (left(trim(_name),60), auth.uid()) RETURNING id INTO g;
  INSERT INTO group_members (group_id, user_id) VALUES (g, auth.uid());
  RETURN g;
END $$;
CREATE OR REPLACE FUNCTION public.join_group(_code text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g uuid;
BEGIN
  SELECT id INTO g FROM groups WHERE invite_code = upper(trim(_code)); IF g IS NULL THEN RAISE EXCEPTION 'No group with that code'; END IF;
  INSERT INTO group_members (group_id, user_id) VALUES (g, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN g;
END $$;
CREATE OR REPLACE FUNCTION public.group_leaderboard(_g uuid) RETURNS TABLE (user_id uuid, username text, level int, streak int, score int, fields_done int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT is_group_member(_g, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  RETURN QUERY SELECT p.id, p.username, p.xp/200+1, user_streak(p.id),
    COALESCE((SELECT sum(fl.difficulty)::int FROM challenge_attempts a JOIN fields fl ON fl.id=a.field_id WHERE a.user_id=p.id AND a.outcome='completed' AND a.created_at > now() - interval '7 days'),0),
    COALESCE((SELECT count(*)::int FROM challenge_attempts a WHERE a.user_id=p.id AND a.outcome='completed' AND a.created_at > now() - interval '7 days'),0)
  FROM group_members m JOIN profiles p ON p.id=m.user_id WHERE m.group_id=_g ORDER BY 5 DESC;
END $$;
CREATE OR REPLACE FUNCTION public.group_feed(_g uuid) RETURNS TABLE (id uuid, username text, text text, cheers int, cheered boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT is_group_member(_g, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  RETURN QUERY SELECT a.id, p.username, a.text, a.cheers, EXISTS (SELECT 1 FROM feed_cheers c WHERE c.feed_id=a.id AND c.user_id=auth.uid()), a.created_at
  FROM activity_feed a JOIN profiles p ON p.id=a.user_id
  WHERE a.user_id IN (SELECT m.user_id FROM group_members m WHERE m.group_id=_g) AND a.created_at > now() - interval '14 days'
  ORDER BY a.created_at DESC LIMIT 50;
END $$;
CREATE OR REPLACE FUNCTION public.group_streak(_g uuid) RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int := 0; d date := (now() AT TIME ZONE 'Europe/Budapest')::date;
BEGIN
  IF NOT is_group_member(_g, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  IF NOT EXISTS (SELECT 1 FROM challenge_attempts a JOIN group_members m ON m.user_id=a.user_id AND m.group_id=_g WHERE a.outcome='completed' AND (a.created_at AT TIME ZONE 'Europe/Budapest')::date = d) THEN d := d - 1; END IF;
  WHILE EXISTS (SELECT 1 FROM challenge_attempts a JOIN group_members m ON m.user_id=a.user_id AND m.group_id=_g WHERE a.outcome='completed' AND (a.created_at AT TIME ZONE 'Europe/Budapest')::date = d) LOOP
    n := n + 1; d := d - 1;
  END LOOP;
  RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.cheer(_feed uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM activity_feed WHERE id=_feed;
  IF owner IS NULL OR owner = auth.uid() THEN RAISE EXCEPTION 'cannot cheer'; END IF;
  IF NOT EXISTS (SELECT 1 FROM group_members a JOIN group_members b ON a.group_id=b.group_id WHERE a.user_id=auth.uid() AND b.user_id=owner) THEN RAISE EXCEPTION 'not in a shared group'; END IF;
  INSERT INTO feed_cheers (feed_id, user_id) VALUES (_feed, auth.uid()) ON CONFLICT DO NOTHING;
  IF FOUND THEN UPDATE activity_feed SET cheers = cheers + 1 WHERE id=_feed; END IF;
END $$;

-- DUELS
CREATE OR REPLACE FUNCTION public.stake_cap(_a uuid, _b uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN LEAST((SELECT szikra FROM profiles WHERE id=_a),(SELECT szikra FROM profiles WHERE id=_b)) < 10 THEN 0
    ELSE LEAST(50, floor(0.2 * (SELECT szikra FROM profiles WHERE id=_a))::int, floor(0.2 * (SELECT szikra FROM profiles WHERE id=_b))::int) END $$;

CREATE OR REPLACE FUNCTION public.create_duel(_opponent uuid, _days int, _difficulty int, _stake int) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d uuid; recent int; w1 int; w2 int;
BEGIN
  IF NOT are_friends(auth.uid(), _opponent) THEN RAISE EXCEPTION 'You can only duel friends'; END IF;
  IF (SELECT count(*) FROM duels WHERE auth.uid() IN (challenger, opponent) AND status IN ('pending','active')) >= 3 THEN RAISE EXCEPTION 'Max 3 active duels'; END IF;
  IF _stake > 0 AND _stake > stake_cap(auth.uid(), _opponent) THEN RAISE EXCEPTION 'Stake is above the allowed cap (%)', stake_cap(auth.uid(), _opponent); END IF;
  SELECT count(*), count(*) FILTER (WHERE r.winner=auth.uid()), count(*) FILTER (WHERE r.winner=_opponent) INTO recent, w1, w2
  FROM duel_results r JOIN duels x ON x.id=r.duel_id
  WHERE r.decided_at > now() - interval '14 days' AND ((x.challenger=auth.uid() AND x.opponent=_opponent) OR (x.challenger=_opponent AND x.opponent=auth.uid())) AND r.outcome='win';
  IF recent >= 4 AND abs(w1 - w2) <= 1 THEN RAISE EXCEPTION 'Duels between you two are paused for a while (unusual win pattern)'; END IF;
  INSERT INTO duels (challenger, opponent, duration_days, target_difficulty, stake, awaiting) VALUES (auth.uid(), _opponent, _days, _difficulty, GREATEST(_stake,0), _opponent) RETURNING id INTO d;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.counter_duel(_duel uuid, _stake int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x duels;
BEGIN
  SELECT * INTO x FROM duels WHERE id=_duel AND status='pending' AND awaiting=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not your turn'; END IF;
  IF _stake > stake_cap(x.challenger, x.opponent) THEN RAISE EXCEPTION 'Stake above cap'; END IF;
  UPDATE duels SET stake = GREATEST(_stake,0), awaiting = CASE WHEN auth.uid()=x.challenger THEN x.opponent ELSE x.challenger END WHERE id=_duel;
END $$;

CREATE OR REPLACE FUNCTION public.decline_duel(_duel uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE duels SET status='declined', awaiting=NULL WHERE id=_duel AND status='pending' AND auth.uid() IN (challenger, opponent);
END $$;

-- called by the user who is awaited; locks escrow
CREATE OR REPLACE FUNCTION public.accept_duel(_duel uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x duels;
BEGIN
  SELECT * INTO x FROM duels WHERE id=_duel AND status='pending' AND awaiting=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not your turn'; END IF;
  IF (SELECT count(*) FROM duels WHERE auth.uid() IN (challenger, opponent) AND status='active') >= 3 THEN RAISE EXCEPTION 'Max 3 active duels'; END IF;
  IF x.stake > 0 THEN
    IF x.stake > stake_cap(x.challenger, x.opponent) THEN RAISE EXCEPTION 'Stake is no longer allowed by the cap'; END IF;
    PERFORM _grant(x.challenger, -x.stake, 0, 'Duel stake (escrow)', 'escrow');
    PERFORM _grant(x.opponent, -x.stake, 0, 'Duel stake (escrow)', 'escrow');
    INSERT INTO duel_escrow (duel_id, user_id, amount) VALUES (_duel, x.challenger, x.stake), (_duel, x.opponent, x.stake);
  END IF;
  UPDATE duels SET status='active', awaiting=NULL, starts_at=now(), ends_at=now() + make_interval(days => x.duration_days) WHERE id=_duel;
  RETURN jsonb_build_object('challenger', x.challenger, 'opponent', x.opponent, 'difficulty', x.target_difficulty);
END $$;

CREATE OR REPLACE FUNCTION public._settle_duel(_duel uuid, _winner uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x duels; loser uuid; pot int; lname text; b duel_badges;
BEGIN
  SELECT * INTO x FROM duels WHERE id=_duel FOR UPDATE;
  IF x.status <> 'active' THEN RETURN; END IF;
  SELECT COALESCE(sum(amount),0) INTO pot FROM duel_escrow WHERE duel_id=_duel AND NOT released;
  IF _winner IS NULL THEN
    PERFORM _grant(e.user_id, e.amount, 0, 'Duel draw refund', 'refund') FROM duel_escrow e WHERE e.duel_id=_duel AND NOT e.released AND e.amount > 0;
    UPDATE duel_escrow SET released=true WHERE duel_id=_duel;
    INSERT INTO duel_results (duel_id, outcome, pot) VALUES (_duel, 'draw', 0);
  ELSE
    loser := CASE WHEN _winner=x.challenger THEN x.opponent ELSE x.challenger END;
    IF pot > 0 THEN PERFORM _grant(_winner, pot, 30, 'Duel win pot', 'earn'); ELSE PERFORM _grant(_winner, 0, 30, 'Duel win', 'earn'); END IF;
    UPDATE duel_escrow SET released=true WHERE duel_id=_duel;
    INSERT INTO duel_results (duel_id, winner, loser, outcome, pot) VALUES (_duel, _winner, loser, 'win', pot);
    SELECT username INTO lname FROM profiles WHERE id=loser;
    SELECT * INTO b FROM duel_badges WHERE winner=_winner AND duel_badges.loser=loser;
    IF NOT FOUND THEN
      INSERT INTO duel_badges (winner, loser) VALUES (_winner, loser);
      PERFORM _award_badge(_winner, 'beat', lname);
    ELSIF b.last_earned < now() - interval '7 days' THEN
      UPDATE duel_badges SET wins = wins + 1, last_earned = now() WHERE winner=_winner AND duel_badges.loser=loser;
      PERFORM _award_badge(_winner, 'beat', lname);
    END IF;
    INSERT INTO activity_feed (user_id, kind, text) VALUES (_winner, 'duel', 'won a duel against ' || lname);
  END IF;
  UPDATE duels SET status='done' WHERE id=_duel;
END $$;
REVOKE ALL ON FUNCTION public._settle_duel(uuid,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_duel_challenge(_duel uuid, _proof text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x duels;
BEGIN
  SELECT * INTO x FROM duels WHERE id=_duel AND auth.uid() IN (challenger, opponent) FOR UPDATE;
  IF NOT FOUND OR x.status <> 'active' THEN RAISE EXCEPTION 'duel not active'; END IF;
  IF now() > x.ends_at THEN PERFORM _settle_duel(_duel, NULL); RETURN jsonb_build_object('result','draw'); END IF;
  IF length(trim(coalesce(_proof,''))) < 10 THEN RAISE EXCEPTION 'Please describe how you did it (at least a sentence)'; END IF;
  UPDATE duel_challenges SET completed_at = now(), proof = left(_proof, 1000) WHERE duel_id=_duel AND user_id=auth.uid() AND completed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'already completed'; END IF;
  PERFORM _settle_duel(_duel, auth.uid());
  RETURN jsonb_build_object('result','win');
END $$;

CREATE OR REPLACE FUNCTION public.forfeit_duel(_duel uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x duels;
BEGIN
  SELECT * INTO x FROM duels WHERE id=_duel AND auth.uid() IN (challenger, opponent) AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'duel not active'; END IF;
  PERFORM _settle_duel(_duel, CASE WHEN auth.uid()=x.challenger THEN x.opponent ELSE x.challenger END);
END $$;

CREATE OR REPLACE FUNCTION public.expire_duel(_duel uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM duels WHERE id=_duel AND auth.uid() IN (challenger, opponent) AND status='active' AND ends_at < now()) THEN
    PERFORM _settle_duel(_duel, NULL);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.flag_duel_proof(_duel uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE duel_challenges SET flagged = true WHERE duel_id=_duel AND user_id <> auth.uid() AND is_duelist(_duel, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.my_duels() RETURNS TABLE (id uuid, other_id uuid, other_name text, duration_days int, target_difficulty int, stake int, status text, awaiting_me boolean, ends_at timestamptz, my_title text, my_desc text, my_done boolean, their_title text, their_done boolean, their_flagged boolean, outcome text, i_won boolean, pot int, created_at timestamptz, i_challenged boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT d.id, o.id, o.username, d.duration_days, d.target_difficulty, d.stake, d.status, d.awaiting = auth.uid(), d.ends_at,
    mc.title, mc.description, mc.completed_at IS NOT NULL, tc.title, tc.completed_at IS NOT NULL, coalesce(tc.flagged,false),
    r.outcome, r.winner = auth.uid(), r.pot, d.created_at, d.challenger = auth.uid()
  FROM duels d
  JOIN profiles o ON o.id = CASE WHEN d.challenger=auth.uid() THEN d.opponent ELSE d.challenger END
  LEFT JOIN duel_challenges mc ON mc.duel_id=d.id AND mc.user_id=auth.uid()
  LEFT JOIN duel_challenges tc ON tc.duel_id=d.id AND tc.user_id=o.id
  LEFT JOIN duel_results r ON r.duel_id=d.id
  WHERE auth.uid() IN (d.challenger, d.opponent) ORDER BY d.created_at DESC $$;

GRANT EXECUTE ON FUNCTION public.buy_item(text), public.redeem_reward(uuid), public.set_pinned_badges(text[]), public.add_friend(text), public.respond_friend(uuid,boolean), public.friend_list(), public.create_group(text), public.join_group(text), public.group_leaderboard(uuid), public.group_feed(uuid), public.group_streak(uuid), public.cheer(uuid), public.create_duel(uuid,int,int,int), public.counter_duel(uuid,int), public.decline_duel(uuid), public.accept_duel(uuid), public.complete_duel_challenge(uuid,text), public.forfeit_duel(uuid), public.expire_duel(uuid), public.flag_duel_proof(uuid), public.my_duels(), public.reward_for(int,boolean), public.stake_cap(uuid,uuid), public.user_streak(uuid) TO authenticated;

-- SEED CATALOG
INSERT INTO public.badges (code,name,description,category,rarity,sort) VALUES
('first_step','First step','Complete your first field','levels','bronze',1),
('field_5','Field 5','Reach your first checkpoint','levels','bronze',2),
('field_25','Field 25','Reach checkpoint 25','levels','silver',3),
('field_50','Field 50','Reach checkpoint 50','levels','gold',4),
('field_100','Field 100','Reach checkpoint 100','levels','diamond',5),
('level_5','Level 5','Reach level 5','levels','silver',6),
('level_10','Level 10','Reach level 10','levels','gold',7),
('clean_1','Day 1','1 day in a row','days','bronze',10),
('clean_3','3 days','3 days in a row','days','bronze',11),
('clean_7','One week','7 days in a row','days','silver',12),
('clean_14','Two weeks','14 days in a row','days','silver',13),
('clean_30','One month','30 days in a row','days','gold',14),
('clean_60','Two months','60 days in a row','days','gold',15),
('clean_100','100 days','100 days in a row','days','diamond',16),
('beat','Beat','Won a duel against a friend','duels','silver',20)
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_items (code,name,description,category,price,monthly_limit,emoji,sort) VALUES
('frame_gold','Gold avatar frame','A shiny frame for your avatar','appearance',120,NULL,'🖼️',1),
('theme_midnight','Midnight theme','A deeper, darker theme','appearance',150,NULL,'🌙',2),
('skin_neon','Neon path skin','Glowing path fields','appearance',180,NULL,'🛤️',3),
('confetti_stars','Star confetti','Stars instead of confetti','appearance',80,NULL,'⭐',4),
('coach_mentor','Wise mentor coach','A calm, wise coach personality','appearance',100,NULL,'🧙',5),
('streak_freeze','Streak freeze','Protects your streak for one missed day','practical',60,2,'🧊',10),
('challenge_swap','Challenge swap','Swap the current field for a different one','practical',40,3,'🔄',11),
('extra_retry','Extra retry','A retry that doesn''t count toward failures','practical',30,3,'🔁',12)
ON CONFLICT DO NOTHING;
INSERT INTO public.growth_programs (code,name,description,price,emoji) VALUES
('running','Start running','30 days from walking to a steady 20-minute run',300,'🏃'),
('sleep','Better sleep','30 days to a calmer evening and steady bedtime',300,'😴'),
('reading','Daily reading','30 days to a reading habit',250,'📚'),
('budgeting','Mindful budgeting','30 days of small money-awareness steps (no real money in the app)',250,'📒')
ON CONFLICT DO NOTHING;
