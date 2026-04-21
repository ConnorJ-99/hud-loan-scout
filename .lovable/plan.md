

# LoanIQ Fixes: DTI, Filtering, Voice, and Conversational Jarvis

## Issues Found

1. **DTI shows 0% for all Agency products**: Most FHA, VA, Conventional, USDA products have `max_dti = NULL` in the database. The code converts NULL to 0 (`Number(p.max_dti ?? 0)`), which displays as "0%" in the UI. Standard industry DTI limits should be used as defaults when NULL (e.g., 50% for Conventional, 56.9% for FHA, no limit for VA).

2. **Wrong loan programs appearing**: The `loan_types` stored in the DB include values like `"Full Doc"`, `"Conventional"`, `"FHA"`, `"Bank Statement"` — but the UI filter uses `"Hard Money"`, `"Bridge"`, `"Non-QM"` which don't exist in the DB. When a user selects "Conventional" in the filter, rehab loans (FHA 203k, Choice Renovation) still show because they also contain "Conventional" or "Full Doc" in their `loan_types` array. No filtering by `product_type` (Agency vs Non-QM) is done. Additionally, the match engine doesn't filter by the borrower's `loanTypePrefs` as a hard filter — it only applies a small 15-point penalty.

3. **Voice cuts off**: `SpeechRecognition` is set to `continuous = false` and `interimResults = false`, so it stops after the first sentence. No audio level visualization exists.

4. **Jarvis response is a wall of text**: The command bar shows raw markdown. User wants card-style results like the scenario search, with ability to continue conversation.

---

## Plan

### Fix 1: DTI Default Values

**File: `src/lib/loaniq/dbCatalog.ts`**

When `max_dti` is NULL, apply standard industry defaults based on loan type:
- FHA: 56.9%
- VA: 60% (effectively unlimited with AUS)
- Conventional: 50%
- USDA: 41%
- Non-QM/DSCR: 0 (meaning "not applicable" — DSCR uses debt service coverage ratio instead)

Update the mapping logic to check `loan_types` and set a sensible default. Display "N/A" in the UI when DTI truly doesn't apply (DSCR products).

**File: `src/components/loaniq/ResultsPanel.tsx`**

Show "N/A" instead of "0%" when `maxDti === 0` (indicating DTI is not applicable for that product type).

### Fix 2: Loan Program Filtering

**File: `src/lib/loaniq/match.ts`**

- Make `loanTypePrefs` a **hard filter** (not just a score penalty). If the borrower selects "Conventional", exclude FHA, VA, DSCR, etc. If "Hard Money" is selected, only show products with "Hard Money" in loan_types.
- Add `product_type` awareness: map borrower loan type preferences to product types. "Conventional" maps to Agency products with "Conventional" in loan_types. "Non-QM" maps to Non-QM product_type. "Hard Money" should only match products explicitly tagged as Hard Money.
- Exclude renovation/rehab products (203k, Choice Renovation) from standard purchase searches unless the borrower specifically indicates a rehab scenario. Add a check: if product name contains "203(k)" or "Renovation" or "Rehab" and borrower hasn't selected a rehab-related special need, skip it.

**File: `src/lib/loaniq/types.ts`**

Add `productType` field to `LenderProduct` interface to carry the `product_type` from DB.

**File: `src/lib/loaniq/dbCatalog.ts`**

Map `product_type` from DB to the new `productType` field.

### Fix 3: Voice Recording with Audio Levels

**File: `src/components/loaniq/JarvisCommandBar.tsx`**

- Set `recognition.continuous = true` and `recognition.interimResults = true` so it keeps listening and shows partial transcription.
- Use `AudioContext` + `AnalyserNode` via `navigator.mediaDevices.getUserMedia()` to get real-time decibel levels while recording.
- Show a visual audio level indicator (animated bar or waveform) next to the mic button while listening.
- Display interim transcript in the input field in real-time (with lighter styling for unfinalized text).
- Add a manual "stop" action (click mic again or press Enter) to finalize.

### Fix 4: Conversational Jarvis with Card Results

**File: `src/components/loaniq/JarvisCommandBar.tsx`**

Major rework to support multi-turn conversation:

- Replace single `response` string with a `messages` array (chat history).
- Send full conversation history to the AI on each turn so it has context.
- The AI can ask follow-up questions ("What's the borrower's FICO?" / "Is this for investment or primary?").
- User responds, AI narrows down, continues until a product is found.

**File: `src/lib/loaniq/ai.ts`**

- Update `askJarvis` to accept and send conversation history (array of `{role, content}` messages) instead of a single query string.
- Return structured data when possible so the UI can render product cards.

**File: `supabase/functions/loaniq-ai/index.ts`**

- Update `SYSTEM_QUERY` prompt to instruct the AI to:
  - Be conversational — ask clarifying questions about FICO, DTI, property type, loan purpose, etc.
  - Filter results strictly — if user says "Conventional", exclude FHA/VA/DSCR/Hard Money.
  - If user says "Hard Money", exclude FHA/Conventional.
  - Return concise, structured results (not walls of text).
  - When enough info is gathered, return a short list of matching products in a structured format.
- Accept `messages` array (multi-turn) instead of single `query` string.
- Keep responses under 300 words for conversational turns.

**File: `src/components/loaniq/JarvisCommandBar.tsx` (UI)**

- Render AI responses that contain product matches as styled cards (similar to ResultsPanel match cards) rather than raw markdown.
- Show conversation thread with user messages and AI responses.
- Keep the input bar at the bottom for continued conversation.
- Add a "New Conversation" button to clear history.

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/lib/loaniq/dbCatalog.ts` | DTI defaults based on loan type, add productType mapping |
| `src/lib/loaniq/types.ts` | Add `productType` to `LenderProduct` |
| `src/lib/loaniq/match.ts` | Hard filter on loanTypePrefs, exclude rehab products, product_type awareness |
| `src/components/loaniq/ResultsPanel.tsx` | Show "N/A" for 0% DTI |
| `src/components/loaniq/JarvisCommandBar.tsx` | Continuous voice with audio levels, multi-turn conversation, card-style results |
| `src/lib/loaniq/ai.ts` | Multi-turn message support |
| `supabase/functions/loaniq-ai/index.ts` | Conversational prompt, strict filtering instructions, accept messages array |

## Priority

1. DTI defaults (quick data fix)
2. Loan type filtering (core matching accuracy)
3. Voice recording (UX)
4. Conversational Jarvis (feature rework)

