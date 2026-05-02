// Edge function: parse-bank-statement
// Reads a PDF from the `bank-statements` private bucket, sends to Lovable AI
// (google/gemini-2.5-pro) with vision, extracts structured statement data
// + classified deposit transactions, persists rows in bank_statements +
// statement_transactions, and returns a summary.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are an expert mortgage underwriter classifying bank statement deposits for income qualification.

You will receive a bank statement PDF. Extract:
1. Bank name, account holder, last 4 of account, statement period (start/end dates).
2. EVERY deposit (credit) transaction. Skip withdrawals/debits.

For each deposit, classify it:
- "Business revenue": ACH from clients/customers, merchant deposits (Square, Stripe, PayPal Business), invoice payments. INCLUDE in income.
- "Payroll / W-2 income": direct deposit from employer, payroll companies (ADP, Gusto). INCLUDE in income.
- "Transfers": between own accounts, "TRANSFER FROM", internal moves. EXCLUDE.
- "Refunds": returns, reversals, refund credits. EXCLUDE.
- "Zelle / Venmo / Cash App": peer-to-peer apps unless clearly business. EXCLUDE by default.
- "Loan proceeds": loan disbursements, line of credit advances, cash advances. EXCLUDE.
- "Non-recurring deposits": one-time large gifts, tax refunds, insurance settlements. EXCLUDE.
- "Duplicate deposits": same amount + same day appearing twice. EXCLUDE the duplicate.
- "Unclear / needs review": cannot determine. EXCLUDE, flag for review.

Be conservative. If unclear, mark "Unclear / needs review" and exclude.

Use the extract_statement tool. Return ALL deposits, no truncation.`;

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
    if (!userData.user) {
      return json({ error: "Not authenticated" }, 401);
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { statementId } = await req.json();
    if (!statementId) return json({ error: "statementId required" }, 400);

    // Fetch statement row (must belong to caller)
    const { data: stmt, error: stmtErr } = await admin
      .from("bank_statements")
      .select("*")
      .eq("id", statementId)
      .maybeSingle();
    if (stmtErr || !stmt) return json({ error: "Statement not found" }, 404);
    if (stmt.created_by !== userId) return json({ error: "Forbidden" }, 403);
    if (!stmt.file_path) return json({ error: "No file_path on statement" }, 400);

    await admin.from("bank_statements").update({ parse_status: "parsing", parse_error: null }).eq("id", statementId);

    // Download PDF
    const { data: fileBlob, error: dlErr } = await admin.storage.from("bank-statements").download(stmt.file_path);
    if (dlErr || !fileBlob) {
      await admin.from("bank_statements").update({ parse_status: "failed", parse_error: dlErr?.message ?? "download failed" }).eq("id", statementId);
      return json({ error: "Download failed: " + dlErr?.message }, 500);
    }

    const ab = await fileBlob.arrayBuffer();
    const base64 = encodeBase64(new Uint8Array(ab));

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
            deposits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  txn_date: { type: "string", description: "YYYY-MM-DD" },
                  description: { type: "string" },
                  deposit_amount: { type: "number" },
                  classification: { type: "string", enum: [
                    "Business revenue", "Payroll / W-2 income", "Transfers", "Refunds",
                    "Zelle / Venmo / Cash App", "Loan proceeds", "Non-recurring deposits",
                    "Duplicate deposits", "Unclear / needs review",
                  ] },
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
            content: [
              { type: "text", text: "Extract every deposit from this bank statement and classify each one. Use the extract_statement tool." },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extract_statement" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      const status = aiRes.status === 429 ? "Rate limit hit" : aiRes.status === 402 ? "AI credits exhausted" : "AI error";
      await admin.from("bank_statements").update({ parse_status: "failed", parse_error: `${status}: ${text.slice(0, 200)}` }).eq("id", statementId);
      return json({ error: status, details: text.slice(0, 500) }, 500);
    }

    const aiJson = await aiRes.json();
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      await admin.from("bank_statements").update({ parse_status: "failed", parse_error: "No tool call returned" }).eq("id", statementId);
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
      await admin.from("bank_statements").update({ parse_status: "failed", parse_error: "Invalid tool args JSON" }).eq("id", statementId);
      return json({ error: "Invalid JSON from AI" }, 500);
    }

    // Update statement row with metadata
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

    const rows = (parsed.deposits ?? []).filter((d) => Number(d.deposit_amount) > 0).map((d) => ({
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
        await admin.from("bank_statements").update({ parse_status: "failed", parse_error: insErr.message }).eq("id", statementId);
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
  const m = /^\d{4}-\d{2}-\d{2}$/.test(d);
  return m ? d : null;
}

function encodeBase64(bytes: Uint8Array): string {
  // Chunked to avoid call-stack issues on large PDFs
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
