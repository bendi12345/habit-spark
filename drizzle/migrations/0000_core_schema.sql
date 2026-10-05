CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  habit_key text NOT NULL,
  name text NOT NULL,
  goal text,
  intensity int NOT NULL DEFAULT 2 CHECK (intensity BETWEEN 1 AND 3),
  current_position int NOT NULL DEFAULT 1,
  last_checkpoint int NOT NULL DEFAULT 0,
  consecutive_failures int NOT NULL DEFAULT 0,
  paused_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habits" ON public.habits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  position int NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  difficulty int NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
  is_checkpoint boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','current','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fields TO authenticated;
GRANT ALL ON public.fields TO service_role;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fields" ON public.fields FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  outcome text NOT NULL CHECK (outcome IN ('completed','failed')),
  action text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.challenge_attempts TO authenticated;
GRANT ALL ON public.challenge_attempts TO service_role;
ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts select" ON public.challenge_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own attempts insert" ON public.challenge_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Game rules (invoker: RLS still scopes everything to the caller)
CREATE OR REPLACE FUNCTION public.complete_field(_habit uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE h public.habits; f public.fields;
BEGIN
  SELECT * INTO h FROM habits WHERE id = _habit AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  IF h.paused_until IS NOT NULL AND h.paused_until > now() THEN RAISE EXCEPTION 'paused'; END IF;
  SELECT * INTO f FROM fields WHERE habit_id = _habit AND position = h.current_position;
  UPDATE fields SET status = 'completed' WHERE id = f.id;
  INSERT INTO challenge_attempts (field_id, habit_id, user_id, outcome) VALUES (f.id, _habit, auth.uid(), 'completed');
  UPDATE fields SET status = 'current' WHERE habit_id = _habit AND position = h.current_position + 1;
  UPDATE habits SET current_position = h.current_position + 1, consecutive_failures = 0, paused_until = NULL,
    last_checkpoint = CASE WHEN f.is_checkpoint THEN f.position ELSE last_checkpoint END
  WHERE id = _habit;
  RETURN jsonb_build_object('checkpoint', f.is_checkpoint, 'position', f.position);
END $$;

CREATE OR REPLACE FUNCTION public.fail_field(_habit uuid, _action text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
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
      title = CASE WHEN title LIKE 'Könnyített: %' THEN title ELSE 'Könnyített: ' || title END,
      description = description || ' (Most egy kisebb lépés is elég – a lényeg, hogy haladj.)'
    WHERE id = f.id;
  END IF;
  RETURN jsonb_build_object('failures', h.consecutive_failures + 1);
END $$;

GRANT EXECUTE ON FUNCTION public.complete_field(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_field(uuid, text) TO authenticated;