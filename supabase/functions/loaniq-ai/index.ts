import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_QUERY = `You are Jarvis, a conversational mortgage advisor. You chat like a senior loan officer texting a colleague — short, direct, helpful.

RULES:
1. Keep EVERY response under 60 words. No exceptions.
2. Ask 1-2 clarifying questions when you need info (FICO, state, occupancy, income type, veteran status, loan amount, DTI).
3. NEVER list product names, FICO ranges, LTV, DTI, or any product details in your text. The UI renders product cards automatically.
4. When you identify matching products, write ONLY a brief conversational note (e.g. "Found 2 FHA DPA options that fit. Want me to pull guidelines?") and append the product IDs block below.
5. ALWAYS append matched product IDs when you mention ANY product — even one. No exceptions.
6. If user says "Conventional" → only Conventional. "FHA" → only FHA. Never mix unless asked.
7. Exclude rehab/renovation unless asked.

PRODUCT ID FORMAT (append at end, every time you reference products):
\`\`\`matched_products
["exact-product-id-1", "exact-product-id-2"]
\`\`\``;

const SYSTEM_SCENARIO = `You are Jarvis, an expert mortgage product matching AI for a mortgage broker.
Given a borrower scenario and a catalog of lender products, identify the TOP 3-5 products the borrower most likely qualifies for.
Be CONCISE. Do NOT list every product — only the best fits.
STRICT FILTERING: Only show products matching the borrower's loan type preferences. If they want Conventional, exclude FHA/VA/Hard Money. If they want Hard Money, exclude Conventional/FHA.
Exclude renovation/rehab products (203k, Choice Renovation) unless the scenario indicates rehab intent.
Format your response in markdown:
**Top Picks** — 1-3 strongest matches. For each: Lender — Product, 2-3 bullet points on why it fits (reference FICO, LTV, DTI, loan type).
**Conditional Matches** — 1-2 products that could work with caveats (1 line each).
**Strategy** — 2-3 sentence broker action plan.
Keep the TOTAL response under 300 words.`;

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
    const { mode, query, messages: chatMessages, scenario, catalog, rawText } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let system: string;
    let apiMessages: { role: string; content: string }[];
    let responseFormat: Record<string, unknown> | undefined;

    if (mode === "scenario") {
      system = SYSTEM_SCENARIO;
      apiMessages = [
        { role: "system", content: system },
        { role: "user", content: `BORROWER SCENARIO:\n${JSON.stringify(scenario, null, 2)}\n\nLENDER CATALOG:\n${JSON.stringify(catalog, null, 2)}` },
      ];
    } else if (mode === "extract") {
      system = SYSTEM_EXTRACT;
      apiMessages = [
        { role: "system", content: system },
        { role: "user", content: `RAW GUIDELINE TEXT:\n${rawText}` },
      ];
      responseFormat = { type: "json_object" };
    } else {
      system = SYSTEM_QUERY;
      const catalogContext = `\n\nLENDER CATALOG:\n${JSON.stringify(catalog, null, 2)}`;

      if (chatMessages && Array.isArray(chatMessages) && chatMessages.length > 0) {
        apiMessages = [{ role: "system", content: system }];
        chatMessages.forEach((msg: { role: string; content: string }, idx: number) => {
          if (idx === 0 && msg.role === "user") {
            apiMessages.push({ role: "user", content: msg.content + catalogContext });
          } else {
            apiMessages.push({ role: msg.role, content: msg.content });
          }
        });
      } else {
        apiMessages = [
          { role: "system", content: system },
          { role: "user", content: `QUESTION: ${query}${catalogContext}` },
        ];
      }
    }

    const requestBody: Record<string, unknown> = {
      model: "google/gemini-3-flash-preview",
      messages: apiMessages,
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

    // For query mode, extract matched product IDs if present
    let matchedProductIds: string[] = [];
    let cleanContent = content;
    const matchBlock = content.match(/```matched_products\s*\n([\s\S]*?)\n```/);
    if (matchBlock) {
      try {
        matchedProductIds = JSON.parse(matchBlock[1].trim());
      } catch { /* ignore parse errors */ }
      cleanContent = content.replace(/```matched_products\s*\n[\s\S]*?\n```/, "").trim();
    }

    return new Response(JSON.stringify({ content: cleanContent, matchedProductIds }), {
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
