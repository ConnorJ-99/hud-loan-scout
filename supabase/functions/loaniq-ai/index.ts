import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_QUERY = `You are Jarvis, a mortgage broker's internal assistant. You talk like a senior LO texting a colleague — short, punchy, no fluff.

CONTEXT: The broker is licensed ONLY in Texas. Never ask which state. Always assume Texas.

RULES:
1. Keep EVERY response under 50 words. Be direct.
2. Ask at most ONE clarifying question per turn — only if truly needed (e.g. FICO, occupancy, income type, veteran status, loan amount). Skip questions you can infer.
3. NEVER list product names, FICO ranges, LTV, DTI, or ANY product details in your text. The UI renders cards automatically.
4. When you find matching products, say something brief like "Found 2 options that work." — the UI handles showing the details.
5. If user says "FHA" → only FHA. "Conventional" → only Conventional. Never mix unless asked.
6. Exclude rehab/renovation unless asked.
7. Filter products for Texas (states array contains "TX" or "ALL").
8. When in doubt, show products and ask "Any of these work?" rather than asking more questions.
9. ALWAYS call the recommend_products function when you identify matching products. This is MANDATORY.`;

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

const SYSTEM_NOTE = `You are LoanIQ's intelligence processor. The user writes a short observation or note about a lender (e.g. "UWM has the best pricing for FHA, VA, and conventional" or "Kind Lending is slow on appraisals").

You are given the current lender catalog. Your job is to:
1. Identify which lender(s) and loan program(s) the note applies to.
2. Return a JSON object with updates to apply.

Return STRICT JSON only:
{
  "lender_name": string,
  "note_summary": string,
  "tags_to_add": string[],
  "programs_affected": [
    {
      "product_id": string,
      "add_to_tags": string[],
      "add_to_notes": string|null,
      "add_to_competitive_advantages": string|null
    }
  ]
}

Rules:
- Match lender name case-insensitively from the catalog.
- For pricing notes, add tags like "best-pricing", "competitive-rates".
- For speed notes, add tags like "fast-turn", "slow-turn".
- For quality notes, add tags like "easy-uw", "strict-uw".
- Only reference product IDs that exist in the catalog.
- Return ONLY the JSON. No backticks, no commentary.`;

// Tool definition for structured product recommendations
const RECOMMEND_PRODUCTS_TOOL = {
  type: "function",
  function: {
    name: "recommend_products",
    description: "Show matching loan products as cards in the UI. Call this EVERY TIME you identify products that match the borrower's needs. Pass all matching product IDs from the catalog.",
    parameters: {
      type: "object",
      properties: {
        product_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of product IDs from the catalog that match the borrower's criteria",
        },
      },
      required: ["product_ids"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, query, messages: chatMessages, scenario, catalog, rawText, noteText } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let system: string;
    let apiMessages: { role: string; content: string }[];
    let responseFormat: Record<string, unknown> | undefined;
    let useTools = false;

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
    } else if (mode === "note") {
      system = SYSTEM_NOTE;
      apiMessages = [
        { role: "system", content: system },
        { role: "user", content: `NOTE: ${noteText}\n\nLENDER CATALOG:\n${JSON.stringify(catalog, null, 2)}` },
      ];
      responseFormat = { type: "json_object" };
    } else {
      // Query / chat mode — use tool calling for product recommendations
      system = SYSTEM_QUERY;
      useTools = true;
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
    if (useTools) {
      requestBody.tools = [RECOMMEND_PRODUCTS_TOOL];
      requestBody.tool_choice = "auto";
    }

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
    const choice = data?.choices?.[0];
    const message = choice?.message;
    const content = message?.content ?? "";

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

    if (mode === "note") {
      const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
      try {
        const parsed = JSON.parse(cleaned);
        return new Response(JSON.stringify({ noteResult: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("note parse fail", e, cleaned.slice(0, 400));
        return new Response(
          JSON.stringify({ error: "Could not parse AI note processing." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // For query mode, extract matched product IDs from tool calls
    let matchedProductIds: string[] = [];
    let cleanContent = content || "";

    // Check for tool calls (structured output)
    const toolCalls = message?.tool_calls;
    if (toolCalls && Array.isArray(toolCalls)) {
      for (const tc of toolCalls) {
        if (tc.function?.name === "recommend_products") {
          try {
            const args = JSON.parse(tc.function.arguments);
            if (Array.isArray(args.product_ids)) {
              matchedProductIds = args.product_ids;
            }
          } catch {
            console.error("Failed to parse tool call args:", tc.function?.arguments);
          }
        }
      }
    }

    // Fallback: also check for text-based matched_products blocks
    if (matchedProductIds.length === 0 && cleanContent) {
      const matchBlock = cleanContent.match(/```matched_products\s*\n?([\s\S]*?)\n?```/) ||
                         cleanContent.match(/matched_products\s*\n?\[([^\]]*)\]/);
      if (matchBlock) {
        try {
          const raw = matchBlock[1].trim();
          const toParse = raw.startsWith("[") ? raw : `[${raw}]`;
          matchedProductIds = JSON.parse(toParse);
        } catch { /* ignore */ }
        cleanContent = cleanContent
          .replace(/```matched_products\s*\n?[\s\S]*?\n?```/g, "")
          .replace(/matched_products\s*\n?\[[^\]]*\]/g, "")
          .trim();
      }
    }

    // Second fallback: if AI mentioned product names but didn't call the tool,
    // try to match product names from the catalog against the response text
    if (matchedProductIds.length === 0 && catalog?.products && cleanContent) {
      const prods = catalog.products as Array<{ id: string; productName: string }>;
      for (const p of prods) {
        if (p.productName && cleanContent.toLowerCase().includes(p.productName.toLowerCase())) {
          matchedProductIds.push(p.id);
        }
      }
      // Limit to top 5
      matchedProductIds = matchedProductIds.slice(0, 5);
    }

    console.log("matchedProductIds:", matchedProductIds.length, matchedProductIds);

    // Fallback: if tool calls returned IDs but content is empty, generate a brief message
    if (matchedProductIds.length > 0 && (!cleanContent || !cleanContent.trim())) {
      cleanContent = `Found ${matchedProductIds.length} option${matchedProductIds.length > 1 ? 's' : ''} that fit. Check the cards.`;
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
