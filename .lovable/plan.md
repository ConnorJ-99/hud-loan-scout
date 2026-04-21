

# LoanIQ Overhaul Plan

This is a significant rework addressing multiple broken features and UX issues. The reference image shows the target UI vision.

## Issues Identified

1. **Sign-in doesn't gate access** — The entire app is visible without authentication. Sign-in should be required before accessing any page.
2. **Jarvis command bar reads from empty localStorage** — `JarvisCommandBar` calls `store.getLenders()` / `store.getProducts()` which reads from localStorage (always empty after the cleanup), instead of fetching from the database.
3. **Scenario form input bug** — Likely a re-render issue causing scroll-to-top on each keystroke.
4. **Match results show "NO MATCHES" despite AI finding matches** — The rule-based `rankMatches` engine filters don't align with the DB product schema (e.g., income type "W2" vs DB storing "Full Doc").
5. **No reset button** on the scenario form.
6. **Product details are too brief** — Clicking a product should open a detailed expanded view with full qualification matrix.
7. **No paste-to-import** — User wants to paste raw guideline text in the catalog to auto-extract and add lenders/products (the Knowledge page already has this, but it's buried and admin-only).
8. **No voice input** for Jarvis command bar.

---

## Plan

### Phase 1: Authentication Gate (Critical)

**Require sign-in to access the app.**

- Create a pathless layout route `src/routes/_authenticated.tsx` with `beforeLoad` that checks Supabase session and redirects to `/auth` if not signed in.
- Move `index.tsx`, `catalog.tsx`, and `knowledge.tsx` under `_authenticated/` prefix so they become `src/routes/_authenticated/index.tsx`, `src/routes/_authenticated/catalog.tsx`, `src/routes/_authenticated/knowledge.tsx`.
- Update the `/auth` page to redirect to `/` after successful sign-in (already does this).
- Remove the "Back to scanner" link on the auth page since unauthenticated users shouldn't bypass login.
- Pass auth context (user, isAdmin) through router context so all child routes can access it.
- Verify the admin account sign-in works by testing the auth flow.

### Phase 2: Fix Jarvis Command Bar (Critical)

**Make Jarvis read from the database, not empty localStorage.**

- Update `JarvisCommandBar` to accept `lenders` and `products` as props from the parent (which already fetches from DB), OR have it call `loadCatalogFromDb()` directly.
- Remove the `store.getLenders()` / `store.getProducts()` calls from the command bar.
- This is why Jarvis says "catalog is empty" — it's reading from localStorage which was intentionally cleared.

### Phase 3: Fix Scenario Form & Results

- **Input scroll bug**: The form likely re-renders the parent on each keystroke causing scroll reset. Will investigate and fix the state update pattern (likely the `set` helper triggering unnecessary re-renders).
- **Add Reset button**: Add a "RESET" button next to the "SCAN FOR MATCHES" button that resets all fields to defaults.
- **Fix match engine alignment**: The `rankMatches` engine checks for income types like "W2" but the DB stores "Full Doc". Need to add mapping logic so "W2" matches "Full Doc", "Bank Statement" matches "Bank Statement", etc.

### Phase 4: Enhanced Product Detail View

**When clicking a product in the catalog or results, show an expanded detail panel.**

Inspired by the reference image's "PROGRAM DETAILS" sidebar:
- Product name, match score, best match indicator
- Full qualification matrix: LTV, credit score range, DTI ratio, min down payment, MIP details, occupancy, loan purpose
- Product guidelines description (full notes, not abbreviated)
- "VIEW FULL GUIDELINES" button
- Available lenders list with their rates
- Implement as a slide-out `Sheet` or a dedicated detail panel on the right side

### Phase 5: Paste-to-Import in Catalog

**Add a "Paste Guidelines" option alongside CSV import and Add Lender.**

- Add a textarea modal in the catalog page where users can paste raw lender guideline text.
- Wire it to the existing `extractGuidelines` + `commitExtraction` flow from `src/lib/loaniq/knowledge.ts`.
- After extraction, show a preview of what was parsed, then commit to DB on confirmation.
- This reuses the existing AI extraction edge function (`loaniq-ai` with mode "extract").

### Phase 6: Voice Input for Jarvis

**Add a microphone button to the Jarvis command bar for voice queries.**

- Use the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) — no external dependencies needed.
- Add a microphone icon button next to the text input.
- When clicked, start listening; transcribed text fills the input field.
- Works on mobile browsers (Chrome, Safari) for phone usage.
- Add a visual indicator (pulsing mic icon) while recording.

### Phase 7: AI Response Length

**The AI scenario analysis is excessively long.** 

- Update the system prompt in the edge function to produce concise, actionable summaries (top 3-5 matches with brief rationale) instead of exhaustive analysis of every possible product.
- Cap response at a reasonable length.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/routes/_authenticated.tsx` | Create — auth layout guard |
| `src/routes/_authenticated/index.tsx` | Move from `src/routes/index.tsx` |
| `src/routes/_authenticated/catalog.tsx` | Move from `src/routes/catalog.tsx` |
| `src/routes/_authenticated/knowledge.tsx` | Move from `src/routes/knowledge.tsx` |
| `src/routes/auth.tsx` | Update — remove "back to scanner" link |
| `src/routes/__root.tsx` | Update — add auth context to router |
| `src/router.tsx` | Update — pass auth context |
| `src/components/loaniq/JarvisCommandBar.tsx` | Fix — read catalog from DB/props, add voice input |
| `src/components/loaniq/ScenarioForm.tsx` | Fix — input scroll bug, add reset button |
| `src/components/loaniq/ResultsPanel.tsx` | Update — enhanced product detail view |
| `src/components/loaniq/ProductDetailPanel.tsx` | Create — expanded product matrix view |
| `src/lib/loaniq/match.ts` | Fix — income type mapping for DB data |
| `src/lib/loaniq/storage.ts` | Clean up — remove seed imports |
| `supabase/functions/loaniq-ai/index.ts` | Update — shorter AI responses |

## Priority Order

1. Auth gate (Phase 1) — blocks everything, security critical
2. Fix Jarvis catalog reading (Phase 2) — core functionality broken
3. Fix scenario form + results (Phase 3) — core functionality broken
4. Product detail view (Phase 4) — key UX improvement
5. Paste-to-import (Phase 5) — workflow improvement
6. Voice input (Phase 6) — mobile UX
7. AI response tuning (Phase 7) — quality improvement

