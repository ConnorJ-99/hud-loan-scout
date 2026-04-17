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
Given a borrower scenario and a catalog of lender products, identify every product the borrower likely qualifies for, rank them by fit quality, explain why each matches or has conditions, and flag any deal-breakers or overlays to watch for.
Be specific, reference actual guideline fields, and think like a senior loan officer.
Format your response in markdown with sections:
**Top Picks** — 1-3 strongest matches with rationale.
**Conditional Matches** — products that work with caveats.
**Deal-Breakers / Overlays to Watch** — any flags.
**Strategy** — broker's next move (structure suggestions, layered programs, etc.).`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, query, scenario, catalog } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const system = mode === "scenario" ? SYSTEM_SCENARIO : SYSTEM_QUERY;
    const userContent =
      mode === "scenario"
        ? `BORROWER SCENARIO:\n${JSON.stringify(scenario, null, 2)}\n\nLENDER CATALOG:\n${JSON.stringify(catalog, null, 2)}`
        : `QUESTION: ${query}\n\nLENDER CATALOG:\n${JSON.stringify(catalog, null, 2)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
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
