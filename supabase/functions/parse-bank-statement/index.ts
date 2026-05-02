// Edge function: parse-bank-statement
// 1. Downloads the PDF from the `bank-statements` private bucket.
// 2. Extracts text with unpdf (no native deps, Deno-compatible).
// 3. Sends the text to Lovable AI (google/gemini-2.5-pro) with a tool schema
//    asking for structured statement metadata + classified deposits.
// 4. Persists rows in bank_statements + statement_transactions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a senior mortgage underwriter classifying bank-statement deposits for income qualification.

You will receive the raw text extracted from a bank statement PDF. Your job:

1. Extract statement metadata: bank_name, account_holder, account_last4, period_start (YYYY-MM-DD), period_end (YYYY-MM-DD), beginning_balance, ending_balance.
2. Extract EVERY deposit / credit transaction. Skip withdrawals, debits, fees, checks paid.
3. Classify each deposit using these categories (case-sensitive):
   - "Business revenue"           -> ACH from clients/customers, merchant deposits (Square, Stripe, PayPal Business), invoice payments. INCLUDE.
   - "Payroll / W-2 income"       -> direct deposit from employer, ADP, Gusto, payroll co. INCLUDE.
   - "Transfers"                  -> "Transfer from", internal moves, between own accounts. EXCLUDE.
   - "Refunds"                    -> returns, reversals, refund credits. EXCLUDE.
   - "Zelle / Venmo / Cash App"   -> P2P apps unless clearly business. EXCLUDE by default.
   - "Loan proceeds"              -> loan disbursements, LOC advances, cash advances. EXCLUDE.
   - "Non-recurring deposits"     -> one-time gifts, tax refunds, insurance settlements, large one-off deposits. EXCLUDE.
   - "Duplicate deposits"         -> same amount + same day twice. EXCLUDE the duplicate.
   - "Unclear / needs review"     -> cannot determine. EXCLUDE, flag for review.

Be conservative: if unclear, mark "Unclear / needs review" and exclude.

Always call the extract_statement tool. Return ALL deposits, no truncation, with reason + confidence (0-1).`;

interface ToolDeposit {
  txn_date: string | null;
  description: string;
  deposit_amount: number;
  classification: string;
  included_in_income: boolean;
  reason: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { statementId } = await req.json();
    if (!statementId) return json({ error: "statementId required" }, 400);

    const { data: stmt, error: stmtErr } = await admin
      .from("bank_statements")
      .select("*")
      .eq("id", statementId)
      .maybeSingle();
    if (stmtErr || !stmt) return json({ error: "Statement not found" }, 404);
    if (stmt.created_by !== userId) return json({ error: "Forbidden" }, 403);
    if (!stmt.file_path) return json({ error: "No file_path on statement" }, 400);

    await admin.from("bank_statements").update({ parse_status: "parsing", parse_error: null }).eq("id", statementId);

    // 1. Download PDF via signed URL (more reliable than SDK .download() for larger files)
    let pdfBytes: Uint8Array | null = null;
    try {
      const { data: signed, error: signErr } = await admin.storage
        .from("bank-statements")
        .createSignedUrl(stmt.file_path, 120);
      if (signErr || !signed?.signedUrl) {
        throw new Error(signErr?.message ?? "could not create signed url");
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 90_000);
      const res = await fetch(signed.signedUrl, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`storage fetch ${res.status}`);
      pdfBytes = new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "download failed";
      await admin.from("bank_statements").update({
        parse_status: "failed",
        parse_error: msg,
      }).eq("id", statementId);
      return json({ error: "Download failed: " + msg }, 500);
    }

    // 2. Extract text with unpdf
    let pdfText = "";
    try {
      const pdf = await getDocumentProxy(pdfBytes);
      const { text } = await extractText(pdf, { mergePages: true });
      pdfText = Array.isArray(text) ? text.join("\n") : (text ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PDF extract failed";
      await admin.from("bank_statements").update({ parse_status: "failed", parse_error: msg }).eq("id", statementId);
      return json({ error: "PDF extract failed: " + msg }, 500);
    }

    if (!pdfText || pdfText.trim().length < 50) {
      const msg = "PDF appears to be image-only / scanned. OCR not yet supported.";
      await admin.from("bank_statements").update({ parse_status: "failed", parse_error: msg }).eq("id", statementId);
      return json({ error: msg }, 422);
    }

    // Truncate very large statements to keep within model limits (~120k chars ≈ 30k tokens)
    const MAX_CHARS = 120_000;
    if (pdfText.length > MAX_CHARS) pdfText = pdfText.slice(0, MAX_CHARS);

    // 3. Call Lovable AI with tool schema
    const tool = {
      type: "function",
      function: {
        name: "extract_statement",
        description: "Return structured bank statement data and classified deposit transactions",
        parameters: {
          type: "object",
          properties: {
            bank_name: { type: "string" },
            account_holder: { type: "string" },
            account_last4: { type: "string" },
            period_start: { type: "string", description: "YYYY-MM-DD" },
            period_end: { type: "string", description: "YYYY-MM-DD" },
            beginning_balance: { type: "number" },
            ending_balance: { type: "number" },
            deposits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  txn_date: { type: "string", description: "YYYY-MM-DD" },
                  description: { type: "string" },
                  deposit_amount: { type: "number" },
                  classification: {
                    type: "string",
                    enum: [
                      "Business revenue",
                      "Payroll / W-2 income",
                      "Transfers",
                      "Refunds",
                      "Zelle / Venmo / Cash App",
                      "Loan proceeds",
                      "Non-recurring deposits",
                      "Duplicate deposits",
                      "Unclear / needs review",
                    ],
                  },
                  included_in_income: { type: "boolean" },
                  reason: { type: "string" },
                  confidence: { type: "number" },
                },
                required: ["description", "deposit_amount", "classification", "included_in_income", "reason", "confidence"],
              },
            },
          },
          required: ["deposits"],
        },
      },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content:
              "Here is the raw text of a bank statement PDF. Extract the metadata and every deposit, classify each, and call the extract_statement tool.\n\n----- BEGIN STATEMENT TEXT -----\n" +
              pdfText +
              "\n----- END STATEMENT TEXT -----",
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extract_statement" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      const status =
        aiRes.status === 429 ? "Rate limit hit"
          : aiRes.status === 402 ? "AI credits exhausted"
          : "AI error";
      await admin.from("bank_statements").update({
        parse_status: "failed",
        parse_error: `${status}: ${text.slice(0, 200)}`,
      }).eq("id", statementId);
      return json({ error: status, details: text.slice(0, 500) }, 500);
    }

    const aiJson = await aiRes.json();
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      await admin.from("bank_statements").update({
        parse_status: "failed",
        parse_error: "No tool call returned",
      }).eq("id", statementId);
      return json({ error: "AI returned no tool call" }, 500);
    }

    let parsed: {
      bank_name?: string;
      account_holder?: string;
      account_last4?: string;
      period_start?: string;
      period_end?: string;
      deposits: ToolDeposit[];
    };
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      await admin.from("bank_statements").update({
        parse_status: "failed",
        parse_error: "Invalid tool args JSON",
      }).eq("id", statementId);
      return json({ error: "Invalid JSON from AI" }, 500);
    }

    // 4. Update statement metadata
    await admin.from("bank_statements").update({
      bank_name: parsed.bank_name ?? null,
      account_holder: parsed.account_holder ?? null,
      account_last4: parsed.account_last4 ?? null,
      period_start: validDate(parsed.period_start),
      period_end: validDate(parsed.period_end),
      parse_status: "parsed",
      parse_error: null,
    }).eq("id", statementId);

    // Replace existing transactions for this statement (re-parse safe)
    await admin.from("statement_transactions").delete().eq("bank_statement_id", statementId);

    const rows = (parsed.deposits ?? [])
      .filter((d) => Number(d.deposit_amount) > 0)
      .map((d) => ({
        created_by: userId,
        income_analysis_id: stmt.income_analysis_id,
        bank_statement_id: statementId,
        txn_date: validDate(d.txn_date),
        description: d.description ?? "",
        deposit_amount: Number(d.deposit_amount) || 0,
        classification: d.classification,
        included_in_income: !!d.included_in_income,
        reason: d.reason ?? null,
        confidence: typeof d.confidence === "number" ? d.confidence : null,
        manual_override: false,
      }));

    if (rows.length > 0) {
      const { error: insErr } = await admin.from("statement_transactions").insert(rows);
      if (insErr) {
        await admin.from("bank_statements").update({
          parse_status: "failed",
          parse_error: insErr.message,
        }).eq("id", statementId);
        return json({ error: insErr.message }, 500);
      }
    }

    return json({
      ok: true,
      statementId,
      deposits_extracted: rows.length,
      deposits_included: rows.filter((r) => r.included_in_income).length,
      bank_name: parsed.bank_name,
      period_start: parsed.period_start,
      period_end: parsed.period_end,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}
