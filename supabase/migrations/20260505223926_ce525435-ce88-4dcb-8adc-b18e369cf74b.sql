ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS annual_salary numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_draw numeric NOT NULL DEFAULT 0;

UPDATE public.profiles
SET annual_salary = COALESCE(monthly_salary, 0) * 12
WHERE annual_salary = 0 AND COALESCE(monthly_salary, 0) > 0;

UPDATE public.profiles
SET annual_draw = COALESCE(monthly_draw, 0) * 12
WHERE annual_draw = 0 AND COALESCE(monthly_draw, 0) > 0;