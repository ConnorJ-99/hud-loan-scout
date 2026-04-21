

# Fix: Jarvis Empty Chat Bubbles + Products Not Populating ResultsPanel

## Root Cause

When the AI model uses **tool calling** (the `recommend_products` function), it returns product IDs in the tool call but sets `message.content` to `null` or empty string. The edge function returns this empty content to the frontend, which renders an empty chat bubble. The products also don't populate the ResultsPanel because the content-based fallback matching fails on empty text.

## Plan

### Fix 1: Edge Function — Generate text content even when tool calls are used

**File: `supabase/functions/loaniq-ai/index.ts`**

When tool calls are present but `content` is empty, generate a short fallback message like `"Found {N} options that fit."` so the chat bubble always has visible text. Additionally, if `content` is null and there are no tool calls either, set a fallback like `"Let me look into that."`.

### Fix 2: Edge Function — Ensure tool call content is always populated

Update the AI request to include `tool_choice: "auto"` explicitly, and add a second follow-up system instruction telling the model to always include a brief conversational text reply alongside any tool call. Some models support returning both content and tool calls in the same response when instructed.

### Fix 3: JarvisCommandBar — Handle empty assistant messages gracefully

**File: `src/components/loaniq/JarvisCommandBar.tsx`**

If `result.content` is empty but `result.matchedProductIds` has items, set the assistant message content to a generated string like `"Found {N} matching programs."` so the bubble is never blank.

### Fix 4: Ensure `onMatchedProducts` callback reliably fires

**File: `src/components/loaniq/JarvisCommandBar.tsx`**

The `onMatchedProducts` callback is already called when `matchedProductIds.length > 0`. Verify this path works by adding a console.log. The parent `Index` component already has `handleJarvisMatchedProducts` wired up — this should work once content/IDs are correctly returned.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/loaniq-ai/index.ts` | Add fallback content when tool calls return empty content |
| `src/components/loaniq/JarvisCommandBar.tsx` | Client-side fallback for empty content with matched products |

