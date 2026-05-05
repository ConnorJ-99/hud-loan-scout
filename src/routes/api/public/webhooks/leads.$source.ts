import { createFileRoute } from "@tanstack/react-router";
import { handleWebhook } from "@/lib/ops/webhook-handler";
import type { LeadSource } from "@/lib/ops/loan-helpers";

const VALID_SOURCES: LeadSource[] = ["ghl", "zapier", "website", "zillow", "other"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-webhook-secret",
};

export const Route = createFileRoute("/api/public/webhooks/leads/$source")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request, params }) => {
        const source = params.source as LeadSource;
        if (!VALID_SOURCES.includes(source)) {
          return new Response("Unknown source", { status: 400, headers: corsHeaders });
        }
        const res = await handleWebhook(source, request);
        // Add CORS headers
        const headers = new Headers(res.headers);
        for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      },
    },
  },
});
