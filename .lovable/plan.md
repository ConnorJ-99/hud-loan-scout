

# Fix: Edge Function 500 Error

## Diagnosis

The `loaniq-ai` edge function is returning a non-2xx status code. Need to inspect logs and the function code to find the root cause before fixing.

## Investigation Plan

1. Pull recent error logs from `loaniq-ai` to see the actual stack trace / error message.
2. Review `supabase/functions/loaniq-ai/index.ts` for the failing branch (most likely the `query` mode used by Jarvis, since that's what triggers on the home page after login).
3. Check whether the catalog payload size, an AI gateway response shape change, or a malformed tool call is causing the throw.

## Likely Root Causes (to confirm during fix)

- **AI Gateway error not handled**: The function may throw on 429/402 responses from Lovable AI gateway and bubble up as a 500 instead of a structured error.
- **Tool-call parsing**: If Gemini returns no `tool_calls` array, accessing `.function.arguments` throws.
- **Large catalog payload**: With 15 lenders + many programs now tagged, the prompt may exceed token limits, returning an error response that isn't gracefully handled.
- **JSON parse failure** in `extract`/`note` modes if the model returns text wrapped in markdown fences.

## Fix Approach

1. **Add defensive error handling** around the AI gateway fetch:
   - Wrap response parsing in try/catch
   - Always return a 200 with `{ error: "..." }` in the body so the frontend can display a friendly message instead of the generic "non-2xx" error
   - Log the upstream status + body before responding

2. **Harden tool-call extraction** in `query` mode:
   - Guard against missing `tool_calls`, missing `function`, and unparseable `arguments`
   - Fall back to text-based product ID extraction when tool calls are absent

3. **Trim catalog payload** sent to the AI:
   - Strip large fields (raw notes, full guideline text) and only send the matching-relevant fields (id, lender name, product name, FICO/LTV/DTI, loan types, tags, competitive_advantages summary)
   - Keeps prompt under token limits and reduces latency

4. **Strip markdown fences** from JSON responses in `extract` and `note` modes before `JSON.parse`.

5. **Surface the real error** to the frontend: update `src/lib/loaniq/ai.ts` so when the edge function returns `{ error }`, it's thrown with the actual message (currently it does this but the function isn't returning structured errors on all failure paths).

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/loaniq-ai/index.ts` | Wrap all AI gateway calls in try/catch, return structured `{ error }` JSON with 200 status, harden tool-call parsing, strip markdown fences, trim catalog payload |
| `src/lib/loaniq/ai.ts` | No change needed if it already throws on `data.error` (verify) |

## Verification

After deploying:
1. Test Jarvis chat from home page with a sample query
2. Test Quick Notes ingestion on knowledge page  
3. Test scenario scan to confirm `analyzeScenario` (mode: scenario) still works
4. Check edge function logs to confirm clean execution

