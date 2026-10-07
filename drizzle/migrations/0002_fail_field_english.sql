CREATE OR REPLACE FUNCTION public.fail_field(_habit uuid, _action text)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE h public.habits; f public.fields; target int;
BEGIN
  SELECT * INTO h FROM habits WHERE id = _habit AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  SELECT * INTO f FROM fields WHERE habit_id = _habit AND position = h.current_position;
  IF _action = 'fallback' THEN
    IF h.consecutive_failures < 3 THEN RAISE EXCEPTION 'fallback requires 3 consecutive failures'; END IF;
    target := GREATEST(h.last_checkpoint + 1, 1);
    UPDATE fields SET status = 'locked' WHERE habit_id = _habit AND position >= target AND position <= h.current_position;
    UPDATE fields SET status = 'current' WHERE habit_id = _habit AND position = target;
    UPDATE habits SET current_position = target, consecutive_failures = 0 WHERE id = _habit;
    RETURN jsonb_build_object('position', target);
  END IF;
  IF _action NOT IN ('retry','easier','pause') THEN RAISE EXCEPTION 'bad action'; END IF;
  INSERT INTO challenge_attempts (field_id, habit_id, user_id, outcome, action) VALUES (f.id, _habit, auth.uid(), 'failed', _action);
  UPDATE habits SET consecutive_failures = consecutive_failures + 1,
    paused_until = CASE WHEN _action = 'pause' THEN now() + interval '24 hours' ELSE paused_until END
  WHERE id = _habit;
  IF _action = 'easier' AND f.difficulty > 1 THEN
    UPDATE fields SET difficulty = GREATEST(1, difficulty - 2),
      title = CASE WHEN title LIKE 'Easier: %' THEN title ELSE 'Easier: ' || title END,
      description = description || ' (A smaller step is enough for now — what matters is moving forward.)'
    WHERE id = f.id;
  END IF;
  RETURN jsonb_build_object('failures', h.consecutive_failures + 1);
END $function$;