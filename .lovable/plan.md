## What we're adding to LoanIQ

A complete **MPS Loan Operations** module ported from your `lead-navigator` app. It plugs into the existing LoanIQ sidebar without touching the current Income Analyzer, Borrowers, Loan Search, Catalog, or Knowledge tools.

### New sidebar sections

**Operations (all signed-in users)**
- **Operations Dashboard** — pipeline KPIs, expected closings 30/60/90, comp forecast by LO, conversion funnel, lead volume by source
- **Lead Intake** — table of raw leads with bulk status/assign, "Move to Tracking" action, manual "+ New Lead" (admin)
- **Tracked Loans** — Kanban + Table view, per-stage rollups, click-through to per-loan detail
- **Loan Detail page** — borrower fields, stage, comp model (percentage / flat), LO/House split %, referral fees editor, stage history, notes, comp breakdown sidebar

**Reports (admin only)**
- **Production by LO** — funded volume, gross commission, LO net + referral income, CSV export
- **Payroll** — per-loan close-date export with splits & fees, totals incl. salary/draw, CSV
- **Profitability** — month-by-month house revenue − salary − expenses = net profit
- **Lead Source ROI** — leads → tracked → funded conversion + revenue per source

**Admin (admin only)**
- **Users & Roles** — create users with role (admin / loan_officer / processor / assistant), change role, delete
- **LO Comp Defaults** — per-LO default comp % used to pre-fill on lead promotion
- **Salary & Draw** — per-staff comp plan + monthly salary/draw, payout history
- **Expenses** — payroll, rent, marketing, Zillow, etc. with recurrence + paid/due tracking
- **Webhooks** — shared-secret URLs for GHL / Zapier / Website / Zillow / Generic intake

### Database changes (one migration)

Add to the existing schema (no destructive changes to current LoanIQ tables):

- New enums: `lead_source`, `lead_status`, `loan_stage`, `comp_mode`, `comp_plan`, `fee_recipient_role`, `fee_deduct_from`, `expense_category`
- Extend `app_role` enum with `loan_officer`, `processor`, `assistant`
- Extend `profiles` with: `full_name`, `email`, `comp_plan`, `monthly_salary`, `monthly_draw`, `default_lo_split_pct`, `default_house_split_pct`, `default_comp_pct`
- New tables: `leads`, `loans`, `loan_stage_history`, `loan_notes`, `loan_fees`, `salary_payouts`, `expenses`, `webhook_config`
- RLS policies — admins manage everything; LOs see only loans/leads assigned to them
- Triggers: stage history logger, auto-set `actual_close_date` on funded, `assign_first_admin` adapted to existing setup

### Auth / role model

The upload uses **admin / loan_officer / processor / assistant** instead of LoanIQ's `admin / user`. I'll extend the enum (add new values; keep `user` for backward compat). The existing `has_role` function already works with the new values.

### File layout

```
src/routes/_authenticated/
  ops/
    index.tsx              → Operations Dashboard
    leads.tsx              → Lead Intake table
    leads.$leadId.tsx      → Lead detail
    loans.tsx              → Tracked Loans (Kanban + Table)
    loans.$loanId.tsx      → Loan detail (comp, fees, notes, history)
    reports.production.tsx
    reports.payroll.tsx
    reports.profitability.tsx
    reports.lead-sources.tsx
    admin.users.tsx
    admin.compensation.tsx
    admin.salary.tsx
    admin.expenses.tsx
    admin.webhooks.tsx

src/routes/api/public/webhooks/
  ghl.ts, zapier.ts, website.ts, zillow.ts, generic.ts

src/components/ops/
  page-header.tsx, new-lead-dialog.tsx, move-to-tracking-dialog.tsx, loan-fees-editor.tsx

src/lib/ops/
  loan-helpers.ts          (enums, formatters, comp calculation)
  webhook-handler.ts       (shared secret + payload normalizer)
```

### Sidebar integration

Update `src/components/loaniq/AppSidebar.tsx` to add a new **OPERATIONS** group above the existing PLATFORM section, with conditional Reports/Admin sub-groups for admins.

### Things I'm NOT changing

- Existing Income Analyzer, Borrowers, Loan Search, Catalog, Knowledge, Settings, Reports tools — untouched
- Existing `bank_statements`, `income_analyses`, `lenders`, `loan_programs`, `borrower_files` tables — untouched
- Jarvis, design tokens, theme

### Order of operations

1. **Migration** (single SQL): enums, profile extensions, all new tables + RLS + triggers
2. **Helper libs**: `src/lib/ops/loan-helpers.ts`, `src/lib/ops/webhook-handler.ts`
3. **Shared UI components**: `page-header`, dialogs, fees editor
4. **Routes**: dashboard, leads, loans (list + detail) — usable by all authenticated staff
5. **Admin routes** + **Reports routes** — gated by `useAuth().isAdmin`
6. **Webhook server routes** under `src/routes/api/public/webhooks/`
7. **Sidebar update** to surface new module

### Open questions before I build

The upload's role enum is `admin / loan_officer / processor / assistant`. Your current LoanIQ has `admin / user`. **I'll add the new role values alongside `user`** — no existing users get downgraded; new staff added via the Users admin page get the proper role. Anyone currently with `user` will see the Operations module like a loan_officer (only their own leads/loans). Confirm this is OK or tell me otherwise.

Also: the upload's webhook handler normalizes payloads from GHL / Zillow / Zapier / website forms with shared-secret auth via the `x-webhook-secret` header. I'll port it as-is.