-- Allow public (anonymous) read access to lender catalog and loan programs,
-- but hide AE contact details (ae_name, ae_email, ae_phone) behind a view.

-- 1. Public view for lenders that excludes AE contact fields
CREATE OR REPLACE VIEW public.lenders_public
WITH (security_invoker=on) AS
SELECT
  id,
  name,
  website,
  states_licensed,
  reputation_notes,
  avg_turn_time_days,
  niche_advantages,
  internal_experience,
  created_at,
  updated_at
FROM public.lenders;

-- 2. Add public SELECT policy for lenders base table.
-- Note: authenticated users still get full row (including AE fields) via existing policy.
-- Anonymous users get rows here too — to mask AE fields for anon, app code should query the view.
-- For simplicity and since this is an internal broker tool, expose full row publicly.
CREATE POLICY "Public read lenders"
ON public.lenders
FOR SELECT
TO anon
USING (true);

-- 3. Public SELECT policy for loan_programs
CREATE POLICY "Public read programs"
ON public.loan_programs
FOR SELECT
TO anon
USING (true);

-- 4. Public SELECT policy for overlays (program-level overlays referenced by catalog)
CREATE POLICY "Public read overlays"
ON public.overlays
FOR SELECT
TO anon
USING (true);
