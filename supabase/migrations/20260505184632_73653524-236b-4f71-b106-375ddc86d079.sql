-- Add new lead source enum values (cannot remove existing safely)
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'realtor';
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'referral';

-- Add fields to leads for richer intake
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS loan_amount numeric,
  ADD COLUMN IF NOT EXISTS purchase_price numeric,
  ADD COLUMN IF NOT EXISTS loan_type text;

-- Add fields to loans
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS purchase_price numeric,
  ADD COLUMN IF NOT EXISTS interest_rate numeric,
  ADD COLUMN IF NOT EXISTS realtor_name text,
  ADD COLUMN IF NOT EXISTS realtor_phone text,
  ADD COLUMN IF NOT EXISTS realtor_email text;