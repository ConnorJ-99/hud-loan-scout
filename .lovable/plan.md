

# Fix: Scan Returns 0 Matches + ResultsPanel Guard for Jarvis Products

## Two Issues

### Issue 1: Scan shows "NO MATCHES" despite valid scenario
The screenshot shows: purchase price $250,000, loan amount $250,000, down payment 0%, DPA toggled ON. This means LTV = 100%. But FHA products typically cap at 96.5% LTV. The hard filter `if (ltv > p.maxLtv + 0.01) return null` kills every product.

When a borrower needs DPA and enters 0 down payment, they are saying "DPA will cover my down payment." The matching engine should relax the LTV check for DPA-eligible products: if the product has DPA available and the borrower needs DPA, treat the effective LTV as `maxLtv` (i.e., skip the LTV hard filter for that product) since DPA covers the gap.

### Issue 2: ResultsPanel shows "AWAITING SCENARIO INPUT" when Jarvis populates matches
Line 85: `if (!scenario && !scanning)` returns the placeholder even when `matches` has data from Jarvis. Already identified in prior plan.

## Changes

### 1. Fix LTV hard filter for DPA scenarios
**File: `src/lib/loaniq/match.ts`** (line 132)

Change the LTV check from:
```
if (ltv > p.maxLtv + 0.01) return null;
```
to:
```
// When borrower needs DPA and product offers DPA, skip LTV hard filter
// (DPA covers the down payment gap, so effective first-mortgage LTV matches product max)
const dpaCoversLtv = s.needsDPA && p.dpaAvailable;
if (!dpaCoversLtv && ltv > p.maxLtv + 0.01) return null;
```

Also add a caveat when DPA is bridging the LTV gap:
```
if (dpaCoversLtv && ltv > p.maxLtv) {
  caveats.push(`LTV ${ltv.toFixed(1)}% requires DPA to cover ${(ltv - p.maxLtv).toFixed(1)}% gap`);
}
```

### 2. Fix default state to Texas
**File: `src/components/loaniq/ScenarioForm.tsx`** (line 20)

Change `state: "CA"` to `state: "TX"` in the DEFAULT object, since the broker is licensed only in Texas.

### 3. Fix ResultsPanel guard for Jarvis-sourced matches
**File: `src/components/loaniq/ResultsPanel.tsx`** (line 85)

Change:
```
if (!scenario && !scanning) {
```
to:
```
if (!scenario && !scanning && matches.length === 0) {
```

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/loaniq/match.ts` | Relax LTV hard filter when DPA covers down payment |
| `src/components/loaniq/ScenarioForm.tsx` | Default state from CA to TX |
| `src/components/loaniq/ResultsPanel.tsx` | Allow rendering when Jarvis provides matches without a scenario |

