ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_answers jsonb NOT NULL DEFAULT '{}'::jsonb;
