import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_QUERY = `You are LoanIQ, an expert mortgage product matching AI assistant for a mortgage broker.
You will receive a natural-language question and a JSON catalog of lender products.
Identify products that match the intent of the question, explain why they match, and flag caveats.
Be precise: reference actual guideline fields (min FICO, max LTV, max DTI, DPA min FICO, allowed loan types, etc.).
Tone: confident, conversational but technical — like a senior loan officer briefing a colleague.
Format your response in markdown with these sections:
**Answer** — a direct, 2-3 sentence answer.
**Matched Products** — a bulleted list of "Lender — Product Name" with one-line rationale each.
**Caveats** — overlays, deal-breakers, or things to verify.
**Suggested Next Steps** — concrete actions for the broker.`;

const SYSTEM_SCENARIO = `You are LoanIQ, an expert mortgage product matching AI for a mortgage broker.
Given a borrower scenario and a catalog of lender products, identify the TOP 3-5 products the borrower most likely qualifies for.
Be CONCISE. Do NOT list every product — only the best fits.
Format your response in markdown:
**Top Picks** — 1-3 strongest matches. For each: Lender — Product, 2-3 bullet points on why it fits (reference FICO, LTV, DTI, loan type).
**Conditional Matches** — 1-2 products that could work with caveats (1 line each).
**Strategy** — 2-3 sentence broker action plan.
Keep the TOTAL response under 500 words.`;

const SYSTEM_EXTRACT = `You are LoanIQ's Knowledge Extractor. The user pastes raw, messy mortgage guideline text — lender matrices, product guidelines, underwriting overlays, investor emails, broker bulletins, AE updates, PDF text extracts, program announcements.

Your job: extract structured lender intelligence and return STRICT JSON only (no prose, no markdown). The JSON shape MUST be:

{
  "lender": {
    "name": string,
    "ae_name": string|null,
    "ae_email": string|null,
    "ae_phone": string|null,
    "website": string|null,
    "states_licensed": string[],
    "reputation_notes": string|null,
    "avg_turn_time_days": number|null,
    "niche_advantages": string|null
  },
  "programs": [
    {
      "product_name": string,
      "loan_program": string|null,
      "product_type": string|null,
      "min_fico": number|null,
      "max_ltv": number|null,
      "max_dti": number|null,
      "reserve_months": number|null,
      "occupancies": string[],
      "property_types": string[],
      "income_types": string[],
      "loan_types": string[],
      "states": string[],
      "min_loan_amount": number|null,
      "max_loan_amount": number|null,
      "seasoning_months": number|null,
      "bk_seasoning_months": number|null,
      "fc_seasoning_months": number|null,
      "dscr_min": number|null,
      "foreign_national_eligible": boolean,
      "itin_eligible": boolean,
      "dpa_available": boolean,
      "dpa_min_fico": number|null,
      "gift_funds_allowed": boolean,
      "exception_policy": string|null,
      "niche_advantages": string|null,
      "competitive_advantages": string|null,
      "special_programs": string[],
      "notes": string|null,
      "tags": string[]
    }
  ],
  "overlays": [
    { "overlay_type": string, "description": string, "applies_to_program": string|null }
  ],
  "summary": string
}

Rules:
- If the lender name is not stated, infer from context or use "Unknown Lender".
- LTVs and DTIs are PERCENT numbers (e.g. 80, 45). Not decimals.
- Use ISO state codes (CA, TX, FL, ALL).
- Empty arrays not null for array fields.
- Return ONLY the JSON object. No backticks, no commentary.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, query, scenario, catalog, rawText } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let system: string;
    let userContent: string;
    let responseFormat: Record<string, unknown> | undefined;

    if (mode === "scenario") {
      system = SYSTEM_SCENARIO;
      userContent = `BORROWER SCENARIO:\n${JSON.stringify(scenario, null, 2)}\n\nLENDER CATALOG:\n${JSON.stringify(catalog, null, 2)}`;
    } else if (mode === "extract") {
      system = SYSTEM_EXTRACT;
      userContent = `RAW GUIDELINE TEXT:\n${rawText}`;
      responseFormat = { type: "json_object" };
    } else {
      system = SYSTEM_QUERY;
      userContent = `QUESTION: ${query}\n\nLENDER CATALOG:\n${JSON.stringify(catalog, null, 2)}`;
    }

    const requestBody: Record<string, unknown> = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    };
    if (responseFormat) requestBody.response_format = responseFormat;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit hit. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable Workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    if (mode === "extract") {
      // Best-effort parse — strip code fences if model added them
      const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
      try {
        const parsed = JSON.parse(cleaned);
        return new Response(JSON.stringify({ extraction: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("extract parse fail", e, cleaned.slice(0, 400));
        return new Response(
          JSON.stringify({ error: "Could not parse AI extraction. Try again or paste smaller chunks." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("loaniq-ai error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
