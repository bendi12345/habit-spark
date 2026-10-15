CREATE TABLE public.field_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  proof_type text NOT NULL CHECK (proof_type IN ('honor', 'reflection', 'photo')),
  proof_text text,
  storage_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (proof_type = 'honor' AND proof_text IS NOT NULL AND storage_path IS NULL)
    OR (proof_type = 'reflection' AND proof_text IS NOT NULL AND storage_path IS NULL)
    OR (proof_type = 'photo' AND proof_text IS NULL AND storage_path IS NOT NULL)
  ),
  CHECK (proof_text IS NULL OR length(proof_text) BETWEEN 1 AND 2000)
);

CREATE INDEX field_proofs_owner_field_created_idx
  ON public.field_proofs (user_id, field_id, created_at DESC);

ALTER TABLE public.field_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.field_proofs FROM anon, authenticated;
CREATE POLICY "read own field proofs"
  ON public.field_proofs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "submit proof for current own field"
  ON public.field_proofs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = CASE WHEN proof_type = 'honor' THEN 'accepted' ELSE 'pending' END
    AND review_reason IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.fields AS own_field
      WHERE own_field.id = field_proofs.field_id
        AND own_field.user_id = auth.uid()
        AND own_field.status = 'current'
        AND proof_type = CASE
          WHEN own_field.difficulty <= 3 THEN 'honor'
          WHEN own_field.difficulty <= 7 THEN 'reflection'
          ELSE 'photo'
        END
    )
    AND (
      (proof_type = 'photo' AND storage_path LIKE auth.uid()::text || '/' || field_id::text || '/%')
      OR (proof_type <> 'photo' AND storage_path IS NULL)
    )
    AND (
      proof_type <> 'photo'
      OR EXISTS (
        SELECT 1
        FROM storage.objects AS uploaded_object
        WHERE uploaded_object.bucket_id = 'field-proofs'
          AND uploaded_object.name = field_proofs.storage_path
      )
    )
  );
GRANT SELECT, INSERT ON public.field_proofs TO authenticated;
GRANT ALL ON public.field_proofs TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('field-proofs', 'field-proofs', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "upload proof to own current photo field"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'field-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.fields AS own_field
      WHERE own_field.id::text = (storage.foldername(name))[2]
        AND own_field.user_id = auth.uid()
        AND own_field.status = 'current'
        AND own_field.difficulty >= 8
    )
  );
CREATE POLICY "read own proof objects"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'field-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "remove unreferenced own proof uploads"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'field-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.field_proofs AS proof
      WHERE proof.storage_path = storage.objects.name
    )
  );

CREATE OR REPLACE FUNCTION public.require_accepted_field_proof()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.outcome = 'completed' AND NOT EXISTS (
    SELECT 1
    FROM public.field_proofs AS proof
    WHERE proof.field_id = NEW.field_id
      AND proof.user_id = NEW.user_id
      AND proof.status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'accepted proof required';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER challenge_attempt_requires_accepted_proof
  BEFORE INSERT ON public.challenge_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.require_accepted_field_proof();

CREATE OR REPLACE FUNCTION public.consume_field_proof_after_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.field_proofs
  SET status = CASE WHEN NEW.outcome = 'completed' THEN 'used' ELSE 'rejected' END,
      review_reason = CASE
        WHEN NEW.outcome = 'failed' THEN 'A new attempt was recorded. Please submit fresh proof when ready.'
        ELSE review_reason
      END
  WHERE field_id = NEW.field_id
    AND user_id = NEW.user_id
    AND status = 'accepted';
  RETURN NEW;
END;
$$;

ALTER TABLE public.field_proofs
  DROP CONSTRAINT field_proofs_status_check,
  ADD CONSTRAINT field_proofs_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'used'));

CREATE TRIGGER consume_field_proof_after_attempt
  AFTER INSERT ON public.challenge_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.consume_field_proof_after_attempt();
