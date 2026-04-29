
# Product Intelligence Analyzer — Replace Extractor + Feed Jarvis

## Goal

Replace the current shallow "Extract guidelines" flow on the Knowledge Expansion page with a senior-broker analyzer that converts pasted lender text into decision-grade intelligence (when to use, why, underwriting strategy, traps, AI triggers, red flags). The analyst brief is saved per loan program and injected into Jarvis at match time so recommendations cite real reasoning, not just guideline bullets.

## Output Format (locked)

Every analyzed product produces a markdown brief with these exact sections, in order:

1. PRODUCT SUMMARY → Product Name, Core Use Case
2. WHY THIS PRODUCT MATTERS
3. IDEAL BORROWER PROFILE (Strong fit / Weak fit)
4. HARD GUIDELINES (true hard stops only)
5. UNDERWRITING STRATEGY (how the deal gets approved)
6. FUNDS / STRUCTURE BENEFITS
7. COST STRUCTURE
8. OPERATIONAL TRAPS
9. REQUIRED DOCUMENT STACK
10. AI DECISION TRIGGERS (exact borrower phrases)
11. INTERNAL RED FLAGS

The analyzer is instructed to think like a producing LO and refuse to summarize or restate the input.

## Database Changes

Add two columns via migration:

- `loan_programs.broker_brief text` — full markdown analyst brief
- `loan_programs.ai_triggers text[]` — extracted borrower-phrase triggers (used by Jarvis for fast matching)

No new tables. RLS is unchanged (existing policies cover the columns).

## Backend Changes — `supabase/functions/loaniq-ai/index.ts`

Rewrite the `extract` mode into an `analyze` mode:

- New system prompt enforcing the 11-section format, decisive broker voice, and hard rules ("do not summarize, do not restate input").
- Tool-call schema returns:
  - `lender` (name, AE, website, states_licensed, reputation_notes) — minimal, only what's needed to upsert
  - `programs[]` — each with: `product_name`, `product_type`, hard guidelines (min_fico, max_ltv, max_dti, occupancies, property_types, states, reserve_months, etc.), `broker_brief` (full markdown), `ai_triggers[]`, `tags[]`
  - `summary` (one-paragraph executive read for the UI)
- Use `openai/gpt-5` for analysis quality (this is broker reasoning, not a summarizer); fallback to `google/gemini-2.5-pro` on 429.
- Keep existing `query`, `scenario`, `note` modes intact.

Update `query` mode (Jarvis): when assembling catalog context, include each program's `broker_brief` (truncated to ~600 chars) and `ai_triggers` so Jarvis matches on real strategy, not just FICO/LTV. Update the system prompt to tell Jarvis it can cite "use case" reasoning from the brief in its short response.

## Frontend Changes

### `src/lib/loaniq/knowledge.ts`
- Rename `extractGuidelines` → `analyzeProduct`; switch invoke mode to `"analyze"`.
- Update `ExtractionResult` (rename to `AnalysisResult`) to include `broker_brief` and `ai_triggers` per program.
- `commitAnalysis`: persist `broker_brief` + `ai_triggers` along with hard guideline fields.

### `src/routes/_authenticated/knowledge.tsx`
- Rename "Extract Guidelines" panel → "Analyze Product".
- Replace the existing field-by-field preview with a **rendered markdown brief** per program (using `react-markdown`, already implied by ai-chatbot best practices — install if missing).
- Show: lender header, then for each program a card with the full broker brief rendered, plus collapsible "Hard Guidelines" + "AI Triggers" chips.
- Buttons: **Save to Catalog** (commits) / **Discard** / **Re-analyze**.
- Quick Notes flow stays as-is (already fixed).

### `src/lib/loaniq/ai.ts`
- `askJarvis` unchanged on the surface, but the catalog payload type widens to include `broker_brief` + `ai_triggers` (the edge function trims/uses them server-side).

### `src/lib/loaniq/dbCatalog.ts`
- Include `broker_brief` and `ai_triggers` in the SELECT and pass through to the catalog payload sent to Jarvis.

### `src/routes/_authenticated/catalog.tsx`
- Add a "Broker Brief" tab/section on each program detail view that renders the saved markdown (read-only, with an "Edit" affordance that opens a textarea — power-user only).

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/loaniq-ai/index.ts` | New `analyze` mode + Jarvis context now includes briefs/triggers |
| migration | Add `broker_brief`, `ai_triggers` to `loan_programs` |
| `src/lib/loaniq/knowledge.ts` | Rename + persist brief/triggers |
| `src/lib/loaniq/ai.ts` | Wider catalog payload type |
| `src/lib/loaniq/dbCatalog.ts` | Select + pass new columns |
| `src/routes/_authenticated/knowledge.tsx` | Markdown-rendered analyst output |
| `src/routes/_authenticated/catalog.tsx` | Show saved Broker Brief on program detail |
| `package.json` | Add `react-markdown` if not already present |

## Verification

1. Paste a real lender doc on the Knowledge page → confirm brief renders with all 11 sections, decisive tone, no input restatement.
2. Save to catalog → verify `loan_programs.broker_brief` and `ai_triggers` populated in DB.
3. Open the program in Catalog → confirm Broker Brief tab shows the saved markdown.
4. Ask Jarvis a scenario question that should hit one of the AI triggers (e.g. "borrower needs to buy before selling") → confirm the right product is matched and Jarvis's reply reflects the brief's reasoning (not generic guideline bullets).
5. Confirm Texas-only / short-reply Jarvis rules still hold.

