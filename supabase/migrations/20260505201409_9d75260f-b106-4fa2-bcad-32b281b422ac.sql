ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS annual_salary numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_draw numeric NOT NULL DEFAULT 0;

UPDATE public.profiles
SET
  annual_salary = CASE
    WHEN COALESCE(annual_salary, 0) = 0 AND COALESCE(monthly_salary, 0) > 0 THEN COALESCE(monthly_salary, 0) * 12
    ELSE annual_salary
  END,
  annual_draw = CASE
    WHEN COALESCE(annual_draw, 0) = 0 AND COALESCE(monthly_draw, 0) > 0 THEN COALESCE(monthly_draw, 0) * 12
    ELSE annual_draw
  END;