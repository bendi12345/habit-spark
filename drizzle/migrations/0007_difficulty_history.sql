CREATE TABLE public.difficulty_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 10),
  attempt_outcome text NOT NULL CHECK (attempt_outcome IN ('completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX difficulty_history_user_field_created_idx
  ON public.difficulty_history (user_id, field_id, created_at DESC);
ALTER TABLE public.difficulty_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own field difficulty ratings"
  ON public.difficulty_history
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.fields AS owned_field
      WHERE owned_field.id = difficulty_history.field_id
        AND owned_field.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.fields AS owned_field
      WHERE owned_field.id = difficulty_history.field_id
        AND owned_field.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.challenge_attempts AS own_attempt
      WHERE own_attempt.field_id = difficulty_history.field_id
        AND own_attempt.user_id = auth.uid()
        AND own_attempt.outcome = difficulty_history.attempt_outcome
    )
  );
GRANT SELECT, INSERT ON public.difficulty_history TO authenticated;
GRANT ALL ON public.difficulty_history TO service_role;
