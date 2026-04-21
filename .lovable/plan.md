

# Update Lender Catalog with Broker Intelligence

## Overview

Apply your detailed internal lender guide to the database. This involves updating `lenders` table fields (`internal_experience`, `reputation_notes`) and `loan_programs` table fields (`tags`, `competitive_advantages`, `notes`) with real broker experience data. Also merge the duplicate UWM lender entry.

## Changes

### 1. Merge duplicate UWM lender

There are two entries: "UWM" (8 programs) and "United Wholesale Mortgage (UWM)" (3 programs). Reassign the 3 programs from the duplicate to the main "UWM" lender, then delete the duplicate lender record.

### 2. Update lender-level fields

For each of the 15 lenders, update `internal_experience` (your summary/decision rule), `reputation_notes` (pricing/turn time/UW style notes), and `niche_advantages` where your guide adds detail beyond what exists.

| Lender | `internal_experience` (summary) | `reputation_notes` (key traits) |
|--------|------|------|
| A&D Mortgage | Go-to when the file is weird | Good Non-QM pricing. Solid turn times. Flexible UW. Not first choice for vanilla conventional. |
| Brokers First | Use them because pricing is worth dealing with the system | Strong DPA (NHF) and Non-QM pricing. Portal is annoying. |
| Champions Funding | Specialty lender for refinance-heavy investor deals | Strong investor/refi pricing. |
| Change Wholesale | Very strong when borrower qualifies on asset/equity, not income | No Ratio DSCR standout. 20% down, no DTI/income concern. |
| Click n' Close | Best DPA lender. First stop before comparing NHF. | Best DPA pricing, almost like straight FHA. SmartBuy top-tier. |
| EPM | Strong renovation lender, good niche VA/refi option | Good turn times. 203(k)/renovation specialist. |
| Greenbox Loans | One of best ITIN lenders because of leverage | ITIN up to 89% LTV — major differentiator. |
| Lead+ Wholesale | Needs lender-specific testing before primary recommendation | Limited direct experience. |
| Lima One Capital | Strong investor-only lane, deal-structure dependent | Fix & Flip / Bridge / Investor construction. |
| LoanStream Mortgage | Reliable backup for ITIN files | Good pricing, not market-best. |
| Newfi Wholesale | Often first quote for DSCR | Best DSCR pricing. |
| NewRez | Very strong hybrid lender | Strong DSCR + agency pricing competitive with UWM. |
| Pennymac TPO | Excellent refi lender | Free credit reports. Strong streamline execution. |
| Quontic Bank | Pure niche lender, not agency competition | ITIN/FN/Investor niche. |
| UWM | Default lender unless file requires something special | Best all-around agency pricing. Fastest system. Easiest portal. Strong UW consistency. |

### 3. Tag loan programs with decision-rule tags

Add tags to programs so Jarvis can use decision-rule logic:

- **UWM** FHA/Conv/VA programs: add tags `best-agency-pricing`, `fastest-portal`, `default-lender`
- **Click n' Close** DPA programs: add `best-dpa`, `first-choice-dpa`
- **Brokers First** NHF/DPA programs: add `strong-dpa`, `second-choice-dpa`
- **Newfi** DSCR programs: add `best-dscr-pricing`, `first-choice-dscr`
- **NewRez** DSCR programs: add `second-choice-dscr`
- **A&D** DSCR/Non-QM programs: add `third-choice-dscr`, `weird-file-specialist`
- **Greenbox** ITIN programs: add `best-itin`, `first-choice-itin`
- **Quontic** ITIN/FN programs: add `second-choice-itin`
- **LoanStream** ITIN programs: add `third-choice-itin`, `backup-itin`
- **EPM** 203(k)/Renovation programs: add `best-renovation`, `first-choice-renovation`
- **Change** No Ratio DSCR programs: add `best-no-ratio`, `first-choice-no-ratio`
- **Lima One** Fix & Flip programs: add `first-choice-fix-flip`
- **Champions/A&D** specialty programs: add `weird-file-specialist`
- **Pennymac** refi/streamline programs: add `best-refi`, `best-streamline`

### 4. Update competitive_advantages on key programs

Set `competitive_advantages` text on standout programs based on your guide (e.g., Greenbox ITIN: "ITIN up to 89% LTV — major differentiator", Click n' Close DPA: "SmartBuy DPA priced almost like straight FHA").

## Implementation

All updates will be executed as data operations (UPDATE statements) using the insert tool — no schema migrations needed. The lender merge (reassign programs + delete duplicate) will also use the insert tool.

## Files to Modify

No code files need changes. This is purely a database data update across the `lenders` and `loan_programs` tables.

