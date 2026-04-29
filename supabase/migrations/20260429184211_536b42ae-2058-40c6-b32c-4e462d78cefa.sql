ALTER TABLE public.loan_programs
  ADD COLUMN IF NOT EXISTS broker_brief text,
  ADD COLUMN IF NOT EXISTS ai_triggers text[] NOT NULL DEFAULT '{}'::text[];