CREATE TABLE public.future_letters (
  user_id uuid PRIMARY KEY,
  why text NOT NULL DEFAULT '' CHECK (length(why) <= 2000),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.future_letters TO authenticated;
GRANT ALL ON public.future_letters TO service_role;
ALTER TABLE public.future_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own letter" ON public.future_letters FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.replacement_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  minutes integer NOT NULL DEFAULT 5 CHECK (minutes BETWEEN 1 AND 240),
  category text NOT NULL CHECK (category IN ('movement','creative','social','calming','useful')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.replacement_activities TO authenticated;
GRANT ALL ON public.replacement_activities TO service_role;
ALTER TABLE public.replacement_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activities" ON public.replacement_activities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.craving_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  habit_id uuid,
  trigger text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  outcome text CHECK (outcome IN ('resisted','slipped','stopped')),
  distraction text,
  slip_note text,
  szikra integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.craving_sessions TO authenticated;
GRANT ALL ON public.craving_sessions TO service_role;
ALTER TABLE public.craving_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own cravings" ON public.craving_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.habit_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  days integer NOT NULL,
  reason text
);
GRANT SELECT ON public.habit_pauses TO authenticated;
GRANT ALL ON public.habit_pauses TO service_role;
ALTER TABLE public.habit_pauses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own pauses" ON public.habit_pauses FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.start_craving(_trigger text, _habit uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF _habit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM habits WHERE id=_habit AND user_id=auth.uid()) THEN _habit := NULL; END IF;
  UPDATE craving_sessions SET outcome='stopped', ended_at=now() WHERE user_id=auth.uid() AND outcome IS NULL;
  INSERT INTO craving_sessions (user_id, habit_id, trigger) VALUES (auth.uid(), _habit, left(coalesce(trim(_trigger),''),200)) RETURNING id INTO s;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.finish_craving(_id uuid, _outcome text, _distraction text, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c craving_sessions; reward int := 0; rewarded_today int;
BEGIN
  SELECT * INTO c FROM craving_sessions WHERE id=_id AND user_id=auth.uid() AND outcome IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
  IF _outcome NOT IN ('resisted','slipped','stopped') THEN RAISE EXCEPTION 'bad outcome'; END IF;
  IF _outcome='resisted' THEN
    IF now() - c.started_at < interval '14 minutes 50 seconds' THEN RAISE EXCEPTION 'timer not finished'; END IF;
    SELECT count(*) INTO rewarded_today FROM craving_sessions WHERE user_id=auth.uid() AND szikra>0 AND started_at > now() - interval '1 day';
    IF rewarded_today < 3 AND NOT EXISTS (SELECT 1 FROM habits WHERE user_id=auth.uid() AND paused_until > now()) THEN
      reward := 5;
      PERFORM _grant(auth.uid(), 5, 5, 'Craving wave ridden out', 'earn');
    END IF;
  END IF;
  UPDATE craving_sessions SET outcome=_outcome, ended_at=now(), distraction=left(_distraction,80), slip_note=left(_note,1000), szikra=reward WHERE id=_id;
  RETURN jsonb_build_object('szikra', reward);
END $$;

CREATE OR REPLACE FUNCTION public.log_slip_note(_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE craving_sessions SET slip_note=left(_note,1000) WHERE id=_id AND user_id=auth.uid() AND outcome='slipped';
END $$;

CREATE OR REPLACE FUNCTION public.pause_habit(_habit uuid, _days int, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE used int;
BEGIN
  IF _days NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'A pause can be 1 to 7 days'; END IF;
  PERFORM 1 FROM habits WHERE id=_habit AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  IF EXISTS (SELECT 1 FROM habits WHERE id=_habit AND paused_until > now()) THEN RAISE EXCEPTION 'already paused'; END IF;
  SELECT coalesce(sum(days),0) INTO used FROM habit_pauses WHERE user_id=auth.uid() AND starts_at >= date_trunc('month', now());
  IF used + _days > 14 THEN RAISE EXCEPTION 'You have % pause days left this month', GREATEST(14-used,0); END IF;
  INSERT INTO habit_pauses (habit_id, user_id, ends_at, days, reason) VALUES (_habit, auth.uid(), now() + make_interval(days=>_days), _days, left(nullif(trim(_reason),''),200));
  UPDATE habits SET paused_until = now() + make_interval(days=>_days) WHERE id=_habit;
  RETURN jsonb_build_object('left', 14-used-_days);
END $$;

CREATE OR REPLACE FUNCTION public.resume_habit(_habit uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE h habits;
BEGIN
  SELECT * INTO h FROM habits WHERE id=_habit AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  UPDATE habit_pauses SET ends_at=now() WHERE habit_id=_habit AND ends_at > now();
  UPDATE habits SET paused_until=NULL WHERE id=_habit;
  UPDATE fields SET difficulty=LEAST(difficulty,2),
    title = CASE WHEN title LIKE 'Easy restart: %' THEN title ELSE 'Easy restart: ' || title END
  WHERE habit_id=_habit AND position=h.current_position AND status='current' AND NOT is_checkpoint;
END $$;

CREATE OR REPLACE FUNCTION public.user_streak(_u uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d date := (now() AT TIME ZONE 'Europe/Budapest')::date; n int := 0; i int := 0;
  done date[]; paused date[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT (created_at AT TIME ZONE 'Europe/Budapest')::date),'{}') INTO done FROM challenge_attempts WHERE user_id=_u AND outcome='completed';
  SELECT coalesce(array_agg(DISTINCT g::date),'{}') INTO paused FROM habit_pauses p,
    generate_series((p.starts_at AT TIME ZONE 'Europe/Budapest')::date, (LEAST(p.ends_at, now()) AT TIME ZONE 'Europe/Budapest')::date, interval '1 day') g WHERE p.user_id=_u;
  IF NOT (d = ANY(done)) AND NOT (d = ANY(paused)) THEN d := d - 1; END IF;
  WHILE i < 3000 LOOP
    IF d = ANY(done) THEN n := n + 1;
    ELSIF NOT (d = ANY(paused)) THEN EXIT;
    END IF;
    d := d - 1; i := i + 1;
  END LOOP;
  RETURN n;
END $$;