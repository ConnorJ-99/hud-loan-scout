
The user wants to bulk-load their existing lender roster into the Knowledge Center before testing. They're asking which file format works best.

Let me think about what the system can actually ingest right now:

**Current ingestion path** (from `src/routes/knowledge.tsx` + `src/lib/loaniq/knowledge.ts`):
- Single textarea → `extractGuidelines()` → AI parses one lender at a time → commit to DB
- No file upload, no batch mode, no multi-lender parsing

**What I have available as a builder**:
- `document--parse_document` tool — handles PDF, DOCX, PPTX, XLSX, MP3 (first 50 pages)
- Direct DB inserts via migrations or edge functions
- Can build a file-upload UI + batch processor

**Format analysis for the user's situation** (already-known lenders, wants fastest path to loaded data):

1. **PDF/Word guidelines** — messiest, but most authentic source. AI extraction works but one-at-a-time, slow, error-prone for 5-20 lenders.
2. **Excel matrix** — structured, fast, but requires consistent column schema. Best if user has a spreadsheet already.
3. **JSON** — fastest/most reliable but user has to hand-author it (bad).
4. **Plain text dump (one lender per block, separated by `---`)** — works with current paste-and-learn if I add batch splitting. Low friction.

**Best recommendation** depends on what the user already has on hand. Most brokers have:
- PDF guideline matrices from each lender
- Maybe an internal spreadsheet of AE contacts
- Emails/bulletins

The pragmatic answer: **let them upload the source files they already have** (PDF/DOCX from each lender) and I'll build a batch uploader that runs each file through `document--parse_document` → AI extraction → DB commit. This avoids manual reformatting.

I should ask one clarifying question about what they have on hand, then present the plan.

Actually — they asked a direct question about format. I should answer it with a recommendation AND propose the build to support it. Keep this concise.

---

# Plan: Bulk Lender Upload

## Recommended format
**PDF or Word guideline matrices** (whatever the lender originally sent you). Reasons:
- You already have these — zero reformatting
- The AI extractor is built for messy guideline text
- Preserves the source as proof/reference

**Avoid**: hand-building JSON or Excel templates — that's manual data entry, defeats the point.

**If you have an internal spreadsheet** of AE contacts/turn times, upload that too — it'll fill the AE/reputation fields the PDFs usually miss.

## What I'll build (Knowledge Center → Bulk Upload tab)

1. **File drop zone** — accepts PDF, DOCX, XLSX, TXT (multi-file, up to 10 at a time)
2. **Per-file processing pipeline**:
   - Parse file → extract text (PDFs/DOCX use document parser, XLSX flattened to rows)
   - Send text to existing `loaniq-ai` extract endpoint
   - Show extraction preview (lender name, # programs, # overlays detected)
3. **Review & commit** — checkbox each file, edit lender name if AI got it wrong, then "Commit All" inserts into the DB in one batch
4. **Source label auto-set** to filename so you can trace any program back to its source PDF in the Raw Intel Archive

## Edge function changes
Update `loaniq-ai` to also accept a `files` mode that handles already-extracted text per source. The actual file parsing happens client-side via the document parse tool (server-side PDF parsing in the Worker isn't reliable).

## Workflow you'd use
1. Drag all your lender PDFs into the upload zone
2. Wait ~10–20 seconds per file while AI extracts
3. Skim each preview card, fix any wrong lender names
4. Hit "Commit All" → everything goes into the database
5. Then start testing the matching engine with real data

## Practical tip while I build this
If you want to start staging files now: drop them all in one folder. PDFs from lender portals work best. If a lender only sent you a rate sheet (not a full guideline matrix), include any AE emails with overlay info too — paste those as `.txt` files alongside.

---

Want me to build the bulk uploader? Or if you'd rather just start pasting now using the current single-lender flow, that works too — say the word and I'll pause the build.
