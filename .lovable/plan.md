

## Root cause

The `/catalog` page is showing the 5 seed lenders (Flagstar, Angel Oak, Lima One, Carrington, Kind Lending) instead of your 15 imported lenders because:

1. The `lenders` and `loan_programs` tables have RLS policies that only allow **authenticated** users to read them (`Authenticated read lenders` with role `{authenticated}`).
2. You are **not signed in** (header shows "SIGN IN" button in the screenshot).
3. When Supabase blocks the query, `loadCatalogFromDb()` returns empty arrays, then falls back to local seed data — which is why you see the 5 fake demo lenders.

The data is fine. All 15 lenders + 121 programs are confirmed in the database. The catalog just can't see them without auth.

## Fix (two options, I recommend doing both)

**1. Make the catalog publicly readable** (so visitors see your real lender list without signing in)
- Add new RLS policies to `lenders` and `loan_programs` tables: `FOR SELECT TO public USING (true)`.
- This is safe because the catalog data isn't sensitive — it's just public lender names + guideline parameters. Admin-only modification stays intact.
- AE contact details (`ae_email`, `ae_phone`) — your call whether those should be public. If not, I can hide them via a view or restrict those columns.

**2. Remove the seed-data fallback** so the catalog never silently shows fake demo lenders again
- Update `src/lib/loaniq/dbCatalog.ts` so an empty DB result returns empty arrays instead of falling back to `seedLenders`/`seedProducts`.
- Update `/catalog` to show "No lenders yet — sign in to manage" instead of seed data when empty.
- Remove the `ensureSeeded()` call from `/catalog` and `/` so localStorage never gets polluted with the demo lenders again.
- Clear any existing seed data already cached in your browser's localStorage on next page load.

## Files I'll change

- `supabase/migrations/<new>.sql` — add public SELECT policies to `lenders` and `loan_programs` (and optionally `overlays` so program-level overlays render too)
- `src/lib/loaniq/dbCatalog.ts` — remove seed fallback
- `src/routes/catalog.tsx` — remove `ensureSeeded()`, add an empty-state message, add a one-time localStorage cleanup of the seed keys
- `src/routes/index.tsx` — same cleanup (remove `ensureSeeded()`)

## What you'll see after

- `/catalog` immediately shows all 15 imported lenders with their 121 programs, even when signed out
- The 5 demo lenders (Flagstar, Angel Oak, Carrington, Kind Lending, Lima One) disappear unless they were actually in your import (Lima One was)
- The matching engine on `/` works without requiring sign-in too

## Quick decision needed

Should AE contact details (`ae_email`, `ae_phone`, `ae_name`) be visible to anonymous catalog visitors, or kept hidden until signed in? Default recommendation: hide them (those are internal broker contacts you don't want scraped). I'll set the SELECT policy to expose lender names + program guidelines but mask AE fields for anon users via a view if you want that — or just leave them visible if this is an internal-only tool.

