ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS difficulty_reason text;
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS difficulty_shift integer NOT NULL DEFAULT 0;