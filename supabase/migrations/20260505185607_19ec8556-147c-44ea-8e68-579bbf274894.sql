ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS borrower_file_id uuid;
CREATE INDEX IF NOT EXISTS idx_loans_borrower_file_id ON public.loans(borrower_file_id);