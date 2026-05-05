-- =========================================
-- MPS Loan Operations Module
-- =========================================

-- Add new role values to existing app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'loan_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'processor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistant';

-- New enums
DO $$ BEGIN CREATE TYPE public.lead_source AS ENUM ('ghl','zapier','website','zillow','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.lead_status AS ENUM ('new','contacted','not_ready','bad_lead','duplicate','moved_to_tracking'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.loan_stage AS ENUM ('new','application','processing','underwriting','conditional_approval','clear_to_close','funded','lost'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.comp_mode AS ENUM ('percentage','flat'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.comp_plan AS ENUM ('commission_only','salary','salary_plus_commission','draw_against_commission'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.fee_recipient_role AS ENUM ('loan_officer','processor','assistant','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.fee_deduct_from AS ENUM ('lo_split','house_split'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.expense_category AS ENUM ('payroll','rent','marketing','zillow_leads','office','processing','licensing','software','compliance','advertising','team','misc'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS comp_plan public.comp_plan NOT NULL DEFAULT 'commission_only',
  ADD COLUMN IF NOT EXISTS monthly_salary numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_draw numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_lo_split_pct numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS default_house_split_pct numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS default_comp_pct numeric NOT NULL DEFAULT 0;

-- Backfill full_name from display_name
UPDATE public.profiles SET full_name = display_name WHERE full_name IS NULL AND display_name IS NOT NULL;

-- Backfill email from auth.users
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.user_id = u.id AND p.email IS NULL;

-- Allow authenticated users to view all profiles (needed for assignments)
DROP POLICY IF EXISTS "Authenticated view profiles" ON public.profiles;
CREATE POLICY "Authenticated view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- ============ Leads ============
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  source public.lead_source NOT NULL DEFAULT 'other',
  assigned_lo uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.lead_status NOT NULL DEFAULT 'new',
  notes text,
  raw_payload jsonb,
  converted_loan_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_lo ON public.leads(assigned_lo);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins manage all leads" ON public.leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff view assigned leads" ON public.leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR assigned_lo = auth.uid());
CREATE POLICY "Staff update assigned leads" ON public.leads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR assigned_lo = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR assigned_lo = auth.uid());

-- ============ Loans ============
CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_name text NOT NULL,
  borrower_phone text,
  borrower_email text,
  loan_type text,
  loan_amount numeric(14,2) DEFAULT 0,
  assigned_lo uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stage public.loan_stage NOT NULL DEFAULT 'new',
  expected_close_date date,
  actual_close_date date,
  lo_comp_pct numeric(6,4) DEFAULT 0,
  lo_comp_amount numeric(14,2) DEFAULT 0,
  company_revenue numeric(14,2) DEFAULT 0,
  source_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  notes text,
  comp_mode public.comp_mode NOT NULL DEFAULT 'percentage',
  comp_points numeric NOT NULL DEFAULT 0,
  comp_flat_amount numeric NOT NULL DEFAULT 0,
  gross_commission numeric NOT NULL DEFAULT 0,
  lo_split_pct numeric NOT NULL DEFAULT 0.5,
  house_split_pct numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loans_stage ON public.loans(stage);
CREATE INDEX IF NOT EXISTS idx_loans_assigned_lo ON public.loans(assigned_lo);
CREATE INDEX IF NOT EXISTS idx_loans_expected_close ON public.loans(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_loans_actual_close ON public.loans(actual_close_date);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_loans_updated BEFORE UPDATE ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leads ADD CONSTRAINT leads_converted_loan_fk
  FOREIGN KEY (converted_loan_id) REFERENCES public.loans(id) ON DELETE SET NULL;

CREATE POLICY "Admins manage all loans" ON public.loans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff view assigned loans" ON public.loans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR assigned_lo = auth.uid());
CREATE POLICY "Staff update assigned loans" ON public.loans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR assigned_lo = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR assigned_lo = auth.uid());

-- ============ Loan stage history ============
CREATE TABLE IF NOT EXISTS public.loan_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  from_stage public.loan_stage,
  to_stage public.loan_stage NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE INDEX IF NOT EXISTS idx_stage_history_loan ON public.loan_stage_history(loan_id);
ALTER TABLE public.loan_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View stage history if can view loan" ON public.loan_stage_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin')
         OR EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND l.assigned_lo = auth.uid()));
CREATE POLICY "Insert stage history if can edit loan" ON public.loan_stage_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin')
              OR EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND l.assigned_lo = auth.uid()));

CREATE OR REPLACE FUNCTION public.log_loan_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.loan_stage_history (loan_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, NULL, NEW.stage, auth.uid());
  ELSIF (TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage) THEN
    INSERT INTO public.loan_stage_history (loan_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.stage, NEW.stage, auth.uid());
    IF NEW.stage = 'funded' AND NEW.actual_close_date IS NULL THEN
      NEW.actual_close_date := CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_loans_stage_log AFTER INSERT ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.log_loan_stage_change();
CREATE TRIGGER trg_loans_stage_log_upd BEFORE UPDATE ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.log_loan_stage_change();

-- ============ Loan notes ============
CREATE TABLE IF NOT EXISTS public.loan_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loan_notes_loan ON public.loan_notes(loan_id);
ALTER TABLE public.loan_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View notes if can view loan" ON public.loan_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin')
         OR EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND l.assigned_lo = auth.uid()));
CREATE POLICY "Insert notes if can view loan" ON public.loan_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND
              (public.has_role(auth.uid(), 'admin')
               OR EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND l.assigned_lo = auth.uid())));

-- ============ Loan fees ============
CREATE TABLE IF NOT EXISTS public.loan_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_role public.fee_recipient_role NOT NULL DEFAULT 'processor',
  label text,
  amount_mode public.comp_mode NOT NULL DEFAULT 'flat',
  flat_amount numeric NOT NULL DEFAULT 0,
  pct_of_gross numeric NOT NULL DEFAULT 0,
  deduct_from public.fee_deduct_from NOT NULL DEFAULT 'house_split',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loan_fees_loan ON public.loan_fees(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_fees_recipient ON public.loan_fees(recipient_user_id);
ALTER TABLE public.loan_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all loan fees" ON public.loan_fees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff view fees they receive" ON public.loan_fees FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR recipient_user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_fees.loan_id AND l.assigned_lo = auth.uid()));

CREATE TRIGGER trg_loan_fees_updated BEFORE UPDATE ON public.loan_fees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Salary payouts ============
CREATE TABLE IF NOT EXISTS public.salary_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pay_period date NOT NULL,
  salary_amount numeric NOT NULL DEFAULT 0,
  draw_amount numeric NOT NULL DEFAULT 0,
  notes text,
  paid_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_salary_payouts_user ON public.salary_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_payouts_period ON public.salary_payouts(pay_period);
ALTER TABLE public.salary_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage salary payouts" ON public.salary_payouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff view own salary payouts" ON public.salary_payouts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE TRIGGER trg_salary_payouts_updated BEFORE UPDATE ON public.salary_payouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Expenses ============
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category public.expense_category NOT NULL DEFAULT 'misc',
  amount numeric NOT NULL DEFAULT 0,
  date_due date,
  date_paid date,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence text,
  notes text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  department text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date_due ON public.expenses(date_due);
CREATE INDEX IF NOT EXISTS idx_expenses_date_paid ON public.expenses(date_paid);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Webhook config ============
CREATE TABLE IF NOT EXISTS public.webhook_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.webhook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage webhook config" ON public.webhook_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.webhook_config (shared_secret)
SELECT encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.webhook_config);

REVOKE EXECUTE ON FUNCTION public.log_loan_stage_change() FROM public, anon, authenticated;