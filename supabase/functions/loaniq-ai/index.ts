import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_QUERY = `You are Jarvis, a mortgage broker's internal assistant. You talk like a senior LO texting a colleague — short, punchy, no fluff.

CONTEXT: The broker is licensed ONLY in Texas. Never ask which state. Always assume Texas.

The catalog includes a brokerBrief (use case + underwriting strategy summary) and aiTriggers (borrower phrases that map to this product). MATCH on these first — they reflect real broker experience — then verify with FICO/LTV/DTI/loan type.

RULES:
1. Keep EVERY response under 50 words. Be direct.
2. Ask at most ONE clarifying question per turn — only if truly needed (e.g. FICO, occupancy, income type, veteran status, loan amount). Skip questions you can infer.
3. NEVER list product names, FICO ranges, LTV, DTI, or ANY product details in your text. The UI renders cards automatically.
4. When you find matching products, say something brief like "Found 2 options that work." — the UI handles showing the details.
5. If user says "FHA" → only FHA. "Conventional" → only Conventional. Never mix unless asked.
6. Exclude rehab/renovation unless asked.
7. Filter products for Texas (states array contains "TX" or "ALL").
8. When in doubt, show products and ask "Any of these work?" rather than asking more questions.
9. ALWAYS call the recommend_products function when you identify matching products. This is MANDATORY.
10. IMPORTANT: When you call recommend_products, you MUST ALSO include a short text response (e.g. "Found 3 options that fit."). Never return an empty text response.`;

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

const SYSTEM_ANALYZE = `You are LoanIQ's Product Intelligence Analyzer.

You are NOT a summarizer, bullet-point extractor, or PDF parser. You are a senior mortgage broker + underwriter + deal strategist.

Your job: take raw pasted lender text and convert it into BROKER-SIDE DECISION INTELLIGENCE — when to use, why it saves deals, how it qualifies borrowers, what kills the deal, what operational traps exist. Think like a producing LO structuring real loans.

For EACH product identified, produce a markdown analyst brief (broker_brief field) with these EXACT 11 sections, in this exact order, using these exact headings:

## PRODUCT SUMMARY
### Product Name
### Core Use Case
(transaction strategy — buy before sell, DSCR for first-time investor, ITIN, DPA, non-QM income workaround, etc.)

## WHY THIS PRODUCT MATTERS
(why it exists, what borrower pain it solves: trapped equity, DTI problems, self-employed income, non-contingent offers, debt payoff, reserve shortages)

## IDEAL BORROWER PROFILE
**Strong fit:**
- ...
**Weak fit:**
- ...

## HARD GUIDELINES
(true hard stops only: min FICO, max LTV, occupancy, state, property eligibility, reserves, max loan amount, entity, experience, seasoning)

## UNDERWRITING STRATEGY
(HOW the deal gets approved: DTI exclusion, rental offset, DSCR qualification, asset depletion, business bank statements, debt payoff strategy, bridge payoff exclusion, LLC borrower structure, delayed financing)

## FUNDS / STRUCTURE BENEFITS
(what borrower can use funds for: down payment, closing costs, rehab, reserves, debt payoff, bridge funds, seller concessions, IO structure)

## COST STRUCTURE
(fees, points, contract fees, prepayment penalties, balloons, escrow, monthly payment structure — flag unusual fees)

## OPERATIONAL TRAPS
(timeline risks, funding traps, CD/title issues, sequencing requirements, closing gaps, lender-specific conditions — where deals die)

## REQUIRED DOCUMENT STACK
(critical docs only: contract, leases, tax returns, bank statements, operating agreements, appraisal, final CD, reserves verification)

## AI DECISION TRIGGERS
(exact borrower phrases that should trigger this product, in quotes — e.g. "I need to sell first", "My DTI is too high", "I want to buy under my LLC")

## INTERNAL RED FLAGS
(when this product should NOT be recommended: weak credit, condo restrictions, no reserves, FSBO, short seasoning, poor marketability)

HARD RULES:
- Do NOT summarize or restate the input.
- Do NOT produce shallow bullets.
- Be decisive. Be analytical. Be operational.
- If the input is thin, infer like a senior broker would — but only what's defensible.
- ai_triggers must be an array of short borrower phrases (5-12 of them) extracted from the AI DECISION TRIGGERS section.

You MUST call the analyze_product tool to return the structured result. Do not return prose.`;

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

// Tool for the Product Intelligence Analyzer — produces decision-grade broker briefs
const ANALYZE_PRODUCT_TOOL = {
  type: "function",
  function: {
    name: "analyze_product",
    description: "Return the structured product intelligence analysis. Always call this — never return prose.",
    parameters: {
      type: "object",
      properties: {
        lender: {
          type: "object",
          properties: {
            name: { type: "string" },
            ae_name: { type: ["string", "null"] },
            ae_email: { type: ["string", "null"] },
            ae_phone: { type: ["string", "null"] },
            website: { type: ["string", "null"] },
            states_licensed: { type: "array", items: { type: "string" } },
            reputation_notes: { type: ["string", "null"] },
            avg_turn_time_days: { type: ["number", "null"] },
            niche_advantages: { type: ["string", "null"] },
          },
          required: ["name", "states_licensed"],
        },
        programs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_name: { type: "string" },
              loan_program: { type: ["string", "null"] },
              product_type: { type: ["string", "null"] },
              min_fico: { type: ["number", "null"] },
              max_ltv: { type: ["number", "null"] },
              max_dti: { type: ["number", "null"] },
              reserve_months: { type: ["number", "null"] },
              occupancies: { type: "array", items: { type: "string" } },
              property_types: { type: "array", items: { type: "string" } },
              income_types: { type: "array", items: { type: "string" } },
              loan_types: { type: "array", items: { type: "string" } },
              states: { type: "array", items: { type: "string" } },
              min_loan_amount: { type: ["number", "null"] },
              max_loan_amount: { type: ["number", "null"] },
              seasoning_months: { type: ["number", "null"] },
              bk_seasoning_months: { type: ["number", "null"] },
              fc_seasoning_months: { type: ["number", "null"] },
              dscr_min: { type: ["number", "null"] },
              foreign_national_eligible: { type: "boolean" },
              itin_eligible: { type: "boolean" },
              dpa_available: { type: "boolean" },
              dpa_min_fico: { type: ["number", "null"] },
              gift_funds_allowed: { type: "boolean" },
              exception_policy: { type: ["string", "null"] },
              niche_advantages: { type: ["string", "null"] },
              competitive_advantages: { type: ["string", "null"] },
              special_programs: { type: "array", items: { type: "string" } },
              notes: { type: ["string", "null"] },
              tags: { type: "array", items: { type: "string" } },
              broker_brief: {
                type: "string",
                description: "Full markdown analyst brief with all 11 required sections in order",
              },
              ai_triggers: {
                type: "array",
                items: { type: "string" },
                description: "5-12 short borrower phrases that should trigger this product",
              },
            },
            required: ["product_name", "broker_brief", "ai_triggers"],
          },
        },
        overlays: {
          type: "array",
          items: {
            type: "object",
            properties: {
              overlay_type: { type: "string" },
              description: { type: "string" },
              applies_to_program: { type: ["string", "null"] },
            },
            required: ["overlay_type", "description"],
          },
        },
        summary: { type: "string" },
      },
      required: ["lender", "programs", "summary"],
    },
  },
};

// Always return 200 with structured body so the frontend can read .error
function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Strip markdown code fences (```json ... ``` or ``` ... ```) from anywhere in the string
function stripFences(s: string): string {
  if (!s) return "";
  let out = s.trim();
  // Remove leading ```json or ``` fence
  out = out.replace(/^```(?:json)?\s*\n?/i, "");
  // Remove trailing ``` fence
  out = out.replace(/\n?```\s*$/i, "");
  return out.trim();
}

// Trim catalog payload to only matching-relevant fields to keep prompt under token limits
function trimCatalog(catalog: unknown): unknown {
  if (!catalog || typeof catalog !== "object") return catalog;
  const c = catalog as { lenders?: unknown[]; products?: unknown[] };
  const lenders = Array.isArray(c.lenders)
    ? c.lenders.map((l: any) => ({
        id: l?.id,
        name: l?.name,
        statesLicensed: l?.statesLicensed,
        avgTurnTimeDays: l?.avgTurnTimeDays,
        nicheAdvantages: typeof l?.nicheAdvantages === "string" ? l.nicheAdvantages.slice(0, 240) : l?.nicheAdvantages,
      }))
    : [];
  const products = Array.isArray(c.products)
    ? c.products.map((p: any) => ({
        id: p?.id,
        lenderId: p?.lenderId,
        productName: p?.productName,
        productType: p?.productType,
        loanProgram: p?.loanProgram,
        minFico: p?.minFico,
        maxLtv: p?.maxLtv,
        maxDti: p?.maxDti,
        loanTypes: p?.loanTypes,
        propertyTypes: p?.propertyTypes,
        occupancies: p?.occupancies,
        states: p?.states,
        tags: p?.tags,
        specialPrograms: p?.specialPrograms,
        dpaAvailable: p?.dpaAvailable,
        itinEligible: p?.itinEligible,
        foreignNationalEligible: p?.foreignNationalEligible,
        dscrMin: p?.dscrMin,
        competitiveAdvantages: typeof p?.competitiveAdvantages === "string" ? p.competitiveAdvantages.slice(0, 200) : p?.competitiveAdvantages,
        brokerBrief: typeof p?.brokerBrief === "string" ? p.brokerBrief.slice(0, 600) : null,
        aiTriggers: Array.isArray(p?.aiTriggers) ? p.aiTriggers.slice(0, 12) : [],
      }))
    : [];
  return { lenders, products };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, query, messages: chatMessages, scenario, catalog, rawText, noteText } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonOk({ error: "AI service not configured (missing API key)." });
    }

    // Trim catalog for any mode that includes it (note, query, scenario)
    const trimmedCatalog = catalog ? trimCatalog(catalog) : catalog;

    let system: string;
    let apiMessages: { role: string; content: string }[];
    let responseFormat: Record<string, unknown> | undefined;
    let useTools = false;

    if (mode === "scenario") {
      system = SYSTEM_SCENARIO;
      apiMessages = [
        { role: "system", content: system },
        { role: "user", content: `BORROWER SCENARIO:\n${JSON.stringify(scenario, null, 2)}\n\nLENDER CATALOG:\n${JSON.stringify(trimmedCatalog, null, 2)}` },
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
        { role: "user", content: `NOTE: ${noteText}\n\nLENDER CATALOG:\n${JSON.stringify(trimmedCatalog, null, 2)}` },
      ];
      responseFormat = { type: "json_object" };
    } else {
      // Query / chat mode — use tool calling for product recommendations
      system = SYSTEM_QUERY;
      useTools = true;
      const catalogContext = `\n\nLENDER CATALOG:\n${JSON.stringify(trimmedCatalog, null, 2)}`;

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

    let resp: Response;
    try {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    } catch (fetchErr) {
      console.error("AI gateway fetch failed:", fetchErr);
      return jsonOk({ error: "Could not reach AI service. Check your connection and try again." });
    }

    if (!resp.ok) {
      const upstreamText = await resp.text().catch(() => "");
      console.error("AI gateway error", resp.status, upstreamText.slice(0, 500));
      if (resp.status === 429) {
        return jsonOk({ error: "Rate limit hit. Try again in a moment." });
      }
      if (resp.status === 402) {
        return jsonOk({ error: "AI credits exhausted. Add credits in Lovable Workspace settings." });
      }
      return jsonOk({ error: `AI gateway error (${resp.status}). ${upstreamText.slice(0, 200)}` });
    }

    let data: any;
    try {
      data = await resp.json();
    } catch (parseErr) {
      console.error("AI gateway returned non-JSON:", parseErr);
      return jsonOk({ error: "AI service returned an unexpected response. Try again." });
    }

    const choice = data?.choices?.[0];
    const message = choice?.message;
    const content = typeof message?.content === "string" ? message.content : "";

    if (mode === "extract") {
      const cleaned = stripFences(content);
      try {
        const parsed = JSON.parse(cleaned);
        return jsonOk({ extraction: parsed });
      } catch (e) {
        console.error("extract parse fail", e, cleaned.slice(0, 400));
        return jsonOk({ error: "Could not parse AI extraction. Try again or paste smaller chunks." });
      }
    }

    if (mode === "note") {
      const cleaned = stripFences(content);
      try {
        const parsed = JSON.parse(cleaned);
        // Defensive normalization so frontend never crashes on malformed shape
        const normalized = {
          lender_name: typeof parsed?.lender_name === "string" ? parsed.lender_name : "Unknown",
          note_summary: typeof parsed?.note_summary === "string" ? parsed.note_summary : "",
          tags_to_add: Array.isArray(parsed?.tags_to_add) ? parsed.tags_to_add : [],
          programs_affected: Array.isArray(parsed?.programs_affected)
            ? parsed.programs_affected.map((p: any) => ({
                product_id: typeof p?.product_id === "string" ? p.product_id : "",
                add_to_tags: Array.isArray(p?.add_to_tags) ? p.add_to_tags : [],
                add_to_notes: typeof p?.add_to_notes === "string" ? p.add_to_notes : null,
                add_to_competitive_advantages: typeof p?.add_to_competitive_advantages === "string" ? p.add_to_competitive_advantages : null,
              }))
            : [],
        };
        return jsonOk({ noteResult: normalized });
      } catch (e) {
        console.error("note parse fail", e, content.slice(0, 400));
        return jsonOk({ error: "Could not parse AI note processing. Try rephrasing the note." });
      }
    }

    // For query mode, extract matched product IDs from tool calls
    let matchedProductIds: string[] = [];
    let cleanContent = content || "";

    // Check for tool calls (structured output) — defensively
    const toolCalls = message?.tool_calls;
    if (Array.isArray(toolCalls)) {
      for (const tc of toolCalls) {
        if (tc?.function?.name === "recommend_products") {
          const argsStr = tc?.function?.arguments;
          if (typeof argsStr === "string" && argsStr.trim()) {
            try {
              const args = JSON.parse(argsStr);
              if (Array.isArray(args?.product_ids)) {
                matchedProductIds = args.product_ids.filter((x: unknown) => typeof x === "string");
              }
            } catch (toolErr) {
              console.error("Failed to parse tool call args:", toolErr, argsStr.slice(0, 200));
            }
          }
        }
      }
    }

    // Fallback: text-based matched_products blocks
    if (matchedProductIds.length === 0 && cleanContent) {
      const matchBlock = cleanContent.match(/```matched_products\s*\n?([\s\S]*?)\n?```/) ||
                         cleanContent.match(/matched_products\s*\n?\[([^\]]*)\]/);
      if (matchBlock) {
        try {
          const raw = matchBlock[1].trim();
          const toParse = raw.startsWith("[") ? raw : `[${raw}]`;
          const parsed = JSON.parse(toParse);
          if (Array.isArray(parsed)) {
            matchedProductIds = parsed.filter((x: unknown) => typeof x === "string");
          }
        } catch { /* ignore */ }
        cleanContent = cleanContent
          .replace(/```matched_products\s*\n?[\s\S]*?\n?```/g, "")
          .replace(/matched_products\s*\n?\[[^\]]*\]/g, "")
          .trim();
      }
    }

    // Second fallback: name-match against catalog
    if (matchedProductIds.length === 0 && trimmedCatalog && cleanContent) {
      const prods = (trimmedCatalog as { products?: Array<{ id: string; productName: string }> })?.products ?? [];
      for (const p of prods) {
        if (p?.productName && typeof p.productName === "string" &&
            cleanContent.toLowerCase().includes(p.productName.toLowerCase())) {
          matchedProductIds.push(p.id);
        }
      }
      matchedProductIds = matchedProductIds.slice(0, 5);
    }

    console.log("matchedProductIds:", matchedProductIds.length);

    // If tool returned IDs but no text, generate fallback message
    if (matchedProductIds.length > 0 && !cleanContent.trim()) {
      cleanContent = `Found ${matchedProductIds.length} option${matchedProductIds.length > 1 ? "s" : ""} that fit. Check the cards.`;
    }

    // If still completely empty, return a graceful default rather than an empty response
    if (!cleanContent.trim() && matchedProductIds.length === 0) {
      cleanContent = "Tell me a bit more about the borrower (FICO, loan type, occupancy) and I'll surface options.";
    }

    return jsonOk({ content: cleanContent, matchedProductIds });
  } catch (e) {
    console.error("loaniq-ai error", e);
    return jsonOk({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});
