ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pay_frequency text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS pay_day smallint;

CREATE UNIQUE INDEX IF NOT EXISTS salary_payouts_user_period_uidx
  ON public.salary_payouts (user_id, pay_period);