-- 1. Add loan_officer to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'loan_officer';

-- 2. Add NMLS to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nmls text;

-- 3. Add assigned LO + prequal fields to borrower_files
ALTER TABLE public.borrower_files
  ADD COLUMN IF NOT EXISTS assigned_lo_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_lo_name text,
  ADD COLUMN IF NOT EXISTS assigned_lo_email text,
  ADD COLUMN IF NOT EXISTS assigned_lo_nmls text,
  ADD COLUMN IF NOT EXISTS prequal_scenario jsonb,
  ADD COLUMN IF NOT EXISTS discovery_answers jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS suggestions jsonb,
  ADD COLUMN IF NOT EXISTS suggestions_narrative text,
  ADD COLUMN IF NOT EXISTS suggestions_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_borrower_files_assigned_lo ON public.borrower_files(assigned_lo_user_id);