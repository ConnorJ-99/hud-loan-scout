
-- ============================================================
-- Borrower Files
-- ============================================================
CREATE TABLE public.borrower_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  borrower_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  loan_officer TEXT,
  loan_purpose TEXT,
  target_program TEXT,
  property_address TEXT,
  purchase_price NUMERIC,
  loan_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.borrower_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read borrower_files" ON public.borrower_files
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert borrower_files" ON public.borrower_files
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners update borrower_files" ON public.borrower_files
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners delete borrower_files" ON public.borrower_files
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_borrower_files_updated_at
  BEFORE UPDATE ON public.borrower_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_borrower_files_created_by ON public.borrower_files(created_by);

-- ============================================================
-- Loan Searches
-- ============================================================
CREATE TABLE public.loan_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  borrower_file_id UUID REFERENCES public.borrower_files(id) ON DELETE SET NULL,
  nickname TEXT,
  scenario JSONB NOT NULL,
  ai_summary TEXT,
  top_lender TEXT,
  top_product TEXT,
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read loan_searches" ON public.loan_searches
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert loan_searches" ON public.loan_searches
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners delete loan_searches" ON public.loan_searches
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE INDEX idx_loan_searches_created_by ON public.loan_searches(created_by);
CREATE INDEX idx_loan_searches_borrower ON public.loan_searches(borrower_file_id);

-- ============================================================
-- Income Analyses
-- ============================================================
CREATE TABLE public.income_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  borrower_file_id UUID REFERENCES public.borrower_files(id) ON DELETE SET NULL,
  borrower_name TEXT NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT '12-month bank statement',
  statement_period_start DATE,
  statement_period_end DATE,
  months_reviewed INTEGER,
  total_deposits NUMERIC DEFAULT 0,
  excluded_deposits NUMERIC DEFAULT 0,
  qualifying_deposits NUMERIC DEFAULT 0,
  avg_monthly_deposits NUMERIC DEFAULT 0,
  expense_factor NUMERIC NOT NULL DEFAULT 0.5,
  qualifying_monthly_income NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  ai_notes TEXT,
  reviewer_notes TEXT,
  large_deposit_threshold NUMERIC DEFAULT 5000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.income_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read income_analyses" ON public.income_analyses
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert income_analyses" ON public.income_analyses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners update income_analyses" ON public.income_analyses
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners delete income_analyses" ON public.income_analyses
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_income_analyses_updated_at
  BEFORE UPDATE ON public.income_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_income_analyses_created_by ON public.income_analyses(created_by);
CREATE INDEX idx_income_analyses_borrower ON public.income_analyses(borrower_file_id);

-- ============================================================
-- Bank Statements
-- ============================================================
CREATE TABLE public.bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  income_analysis_id UUID NOT NULL REFERENCES public.income_analyses(id) ON DELETE CASCADE,
  file_path TEXT,
  file_name TEXT,
  bank_name TEXT,
  account_holder TEXT,
  account_last4 TEXT,
  period_start DATE,
  period_end DATE,
  parse_status TEXT NOT NULL DEFAULT 'pending',
  parse_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read bank_statements" ON public.bank_statements
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert bank_statements" ON public.bank_statements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners update bank_statements" ON public.bank_statements
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners delete bank_statements" ON public.bank_statements
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE INDEX idx_bank_statements_analysis ON public.bank_statements(income_analysis_id);

-- ============================================================
-- Statement Transactions
-- ============================================================
CREATE TABLE public.statement_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  bank_statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  income_analysis_id UUID NOT NULL REFERENCES public.income_analyses(id) ON DELETE CASCADE,
  txn_date DATE,
  description TEXT,
  deposit_amount NUMERIC,
  withdrawal_amount NUMERIC,
  balance NUMERIC,
  classification TEXT NOT NULL DEFAULT 'Unclear / needs review',
  included_in_income BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  confidence NUMERIC,
  manual_override BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.statement_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read transactions" ON public.statement_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert transactions" ON public.statement_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners update transactions" ON public.statement_transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners delete transactions" ON public.statement_transactions
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE INDEX idx_txn_analysis ON public.statement_transactions(income_analysis_id);
CREATE INDEX idx_txn_statement ON public.statement_transactions(bank_statement_id);

-- ============================================================
-- App Settings (per user)
-- ============================================================
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  default_expense_factor NUMERIC NOT NULL DEFAULT 0.5,
  large_deposit_threshold NUMERIC NOT NULL DEFAULT 5000,
  company_name TEXT,
  company_logo_url TEXT,
  report_branding JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users upsert own settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Storage bucket for bank statement PDFs
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own bank statements"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bank-statements'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Users upload own bank statements"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bank-statements'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own bank statements"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bank-statements'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'))
  );
