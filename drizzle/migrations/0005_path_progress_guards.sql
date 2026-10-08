-- Keep progression state server-authoritative while preserving direct habit creation
-- and edits to non-progression preferences.
REVOKE UPDATE ON public.habits, public.fields FROM authenticated;
GRANT UPDATE (name, goal, intensity) ON public.habits TO authenticated;
REVOKE INSERT ON public.challenge_attempts FROM authenticated;

CREATE OR REPLACE FUNCTION public.complete_field(_habit uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  h public.habits;
  f public.fields;
  next_status text;
  rw jsonb;
  sz int;
  xpv int;
  easy_today int;
  badges_new text[] := '{}';
  before_lvl int;
  after_lvl int;
  total int;
  streak int;
  had_today boolean;
BEGIN
  SELECT * INTO h
  FROM public.habits
  WHERE id = _habit AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  IF h.paused_until IS NOT NULL AND h.paused_until > now() THEN RAISE EXCEPTION 'paused'; END IF;

  SELECT * INTO f
  FROM public.fields
  WHERE habit_id = _habit AND user_id = auth.uid() AND position = h.current_position
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no current field'; END IF;
  IF f.status <> 'current' THEN RAISE EXCEPTION 'not the current field'; END IF;

  IF f.is_checkpoint THEN
    UPDATE public.fields
    SET difficulty = GREATEST(
      difficulty,
      COALESCE((
        SELECT max(previous.difficulty)
        FROM public.fields previous
        WHERE previous.habit_id = _habit
          AND previous.position BETWEEN (((f.position - 1) / 5) * 5 + 1) AND f.position - 1
      ), 1)
    )
    WHERE id = f.id;
    SELECT * INTO f FROM public.fields WHERE id = f.id;
  END IF;

  had_today := EXISTS (
    SELECT 1 FROM public.challenge_attempts
    WHERE user_id = auth.uid()
      AND outcome = 'completed'
      AND (created_at AT TIME ZONE 'Europe/Budapest')::date = (now() AT TIME ZONE 'Europe/Budapest')::date
  );

  SELECT status INTO next_status
  FROM public.fields
  WHERE habit_id = _habit AND position = h.current_position + 1
  FOR UPDATE;
  IF next_status IS NOT NULL AND next_status <> 'locked' THEN
    RAISE EXCEPTION 'next field is not locked';
  END IF;

  UPDATE public.fields SET status = 'completed' WHERE id = f.id;
  INSERT INTO public.challenge_attempts (field_id, habit_id, user_id, outcome)
  VALUES (f.id, _habit, auth.uid(), 'completed');
  UPDATE public.fields
  SET status = 'current'
  WHERE habit_id = _habit AND position = h.current_position + 1 AND status = 'locked';
  UPDATE public.habits
  SET current_position = h.current_position + 1,
      consecutive_failures = 0,
      paused_until = NULL,
      last_checkpoint = CASE WHEN f.is_checkpoint THEN f.position ELSE last_checkpoint END
  WHERE id = _habit;

  rw := public.reward_for(f.difficulty, f.is_checkpoint);
  sz := (rw->>'szikra')::int;
  xpv := (rw->>'xp')::int;
  IF f.difficulty <= 3 AND NOT f.is_checkpoint THEN
    SELECT COALESCE(sum(amount), 0) INTO easy_today
    FROM public.szikra_ledger
    WHERE user_id = auth.uid() AND reason LIKE 'Easy field%' AND created_at > now() - interval '1 day';
    sz := GREATEST(0, LEAST(sz, 20 - easy_today));
  END IF;
  SELECT xp / 200 + 1 INTO before_lvl FROM public.profiles WHERE id = auth.uid();
  PERFORM public._grant(
    auth.uid(), sz, xpv,
    CASE WHEN f.difficulty <= 3 AND NOT f.is_checkpoint THEN 'Easy field ' ELSE 'Field ' END || f.position || ': ' || f.title
  );
  IF NOT had_today THEN
    streak := public.user_streak(auth.uid());
    PERFORM public._grant(auth.uid(), 5, 10, 'Streak day ' || streak);
    IF streak IN (1,3,7,14,30,60,100) AND public._award_badge(auth.uid(), 'clean_' || streak) THEN
      badges_new := badges_new || ('clean_' || streak);
    END IF;
  END IF;
  SELECT count(*) INTO total
  FROM public.challenge_attempts WHERE user_id = auth.uid() AND outcome = 'completed';
  IF total = 1 AND public._award_badge(auth.uid(), 'first_step') THEN
    badges_new := badges_new || 'first_step'::text;
  END IF;
  IF f.is_checkpoint AND f.position IN (5,25,50,100)
    AND public._award_badge(auth.uid(), 'field_' || f.position) THEN
    badges_new := badges_new || ('field_' || f.position);
  END IF;
  SELECT xp / 200 + 1 INTO after_lvl FROM public.profiles WHERE id = auth.uid();
  IF after_lvl >= 5 AND before_lvl < 5 AND public._award_badge(auth.uid(), 'level_5') THEN
    badges_new := badges_new || 'level_5'::text;
  END IF;
  IF after_lvl >= 10 AND before_lvl < 10 AND public._award_badge(auth.uid(), 'level_10') THEN
    badges_new := badges_new || 'level_10'::text;
  END IF;
  INSERT INTO public.activity_feed (user_id, kind, text)
  VALUES (
    auth.uid(),
    CASE WHEN f.is_checkpoint THEN 'checkpoint' ELSE 'field' END,
    CASE WHEN f.is_checkpoint THEN 'reached checkpoint ' || f.position ELSE 'completed field ' || f.position END
  );
  RETURN jsonb_build_object(
    'checkpoint', f.is_checkpoint, 'position', f.position, 'szikra', sz, 'xp', xpv,
    'streak_bonus', NOT had_today, 'level_up', after_lvl > before_lvl, 'level', after_lvl, 'badges', to_jsonb(badges_new)
  );
END $$;

CREATE OR REPLACE FUNCTION public.fail_field(_habit uuid, _action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  h public.habits;
  f public.fields;
  target int;
BEGIN
  SELECT * INTO h
  FROM public.habits
  WHERE id = _habit AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  IF h.paused_until IS NOT NULL AND h.paused_until > now() THEN RAISE EXCEPTION 'paused'; END IF;

  SELECT * INTO f
  FROM public.fields
  WHERE habit_id = _habit AND user_id = auth.uid() AND position = h.current_position
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no current field'; END IF;
  IF f.status <> 'current' THEN RAISE EXCEPTION 'not the current field'; END IF;

  IF _action = 'fallback' THEN
    IF h.consecutive_failures < 3 THEN RAISE EXCEPTION 'fallback requires 3 consecutive failures'; END IF;
    target := GREATEST(h.last_checkpoint + 1, 1);
    IF NOT EXISTS (SELECT 1 FROM public.fields WHERE habit_id = _habit AND position = target) THEN
      RAISE EXCEPTION 'checkpoint field not found';
    END IF;
    UPDATE public.fields
    SET status = 'locked'
    WHERE habit_id = _habit AND position >= target AND position <= h.current_position;
    UPDATE public.fields SET status = 'current' WHERE habit_id = _habit AND position = target;
    UPDATE public.habits
    SET current_position = target, consecutive_failures = 0, paused_until = NULL
    WHERE id = _habit;
    RETURN jsonb_build_object('position', target);
  END IF;

  IF _action NOT IN ('retry', 'easier', 'pause') THEN RAISE EXCEPTION 'bad action'; END IF;
  INSERT INTO public.challenge_attempts (field_id, habit_id, user_id, outcome, action)
  VALUES (f.id, _habit, auth.uid(), 'failed', _action);
  UPDATE public.habits
  SET consecutive_failures = consecutive_failures + 1,
      paused_until = CASE WHEN _action = 'pause' THEN now() + interval '24 hours' ELSE paused_until END
  WHERE id = _habit;
  IF _action = 'easier' AND f.difficulty > 1 THEN
    UPDATE public.fields
    SET difficulty = GREATEST(
        1,
        difficulty - 2,
        CASE WHEN f.is_checkpoint THEN COALESCE((
          SELECT max(previous.difficulty)
          FROM public.fields previous
          WHERE previous.habit_id = _habit
            AND previous.position BETWEEN (((f.position - 1) / 5) * 5 + 1) AND f.position - 1
        ), 1) ELSE 1 END
      ),
      title = CASE WHEN title LIKE 'Könnyített: %' THEN title ELSE 'Könnyített: ' || title END,
      description = description || ' (Most egy kisebb lépés is elég – a lényeg, hogy haladj.)'
    WHERE id = f.id;
  END IF;
  RETURN jsonb_build_object('failures', h.consecutive_failures + 1);
END $$;

REVOKE ALL ON FUNCTION public.complete_field(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fail_field(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_field(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_field(uuid, text) TO authenticated;
