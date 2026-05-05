import { createClient } from "@supabase/supabase-js";
import type { LeadSource } from "@/lib/ops/loan-helpers";

type Normalized = { name: string; phone: string | null; email: string | null; notes: string | null };

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function normalize(source: LeadSource, payload: unknown): Normalized {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  switch (source) {
    case "ghl": {
      const first = pick(p, ["first_name", "firstName"]);
      const last = pick(p, ["last_name", "lastName"]);
      const full = pick(p, ["full_name", "fullName", "name", "contact_name"]);
      return {
        name: full || [first, last].filter(Boolean).join(" ") || "Unknown",
        phone: pick(p, ["phone", "phone_number"]),
        email: pick(p, ["email"]),
        notes: pick(p, ["message", "notes", "comment"]),
      };
    }
    case "zillow": {
      const contact = (p["contact"] as Record<string, unknown>) ?? p;
      const first = pick(contact, ["firstName", "first_name"]);
      const last = pick(contact, ["lastName", "last_name"]);
      return {
        name: [first, last].filter(Boolean).join(" ") || pick(contact, ["name"]) || "Zillow Lead",
        phone: pick(contact, ["phone", "phoneNumber"]),
        email: pick(contact, ["email"]),
        notes: pick(p, ["message", "comment", "propertyAddress"]),
      };
    }
    default: {
      const first = pick(p, ["first_name", "firstName"]);
      const last = pick(p, ["last_name", "lastName"]);
      const full = pick(p, ["name", "full_name", "fullName"]);
      return {
        name: full || [first, last].filter(Boolean).join(" ") || "Unknown",
        phone: pick(p, ["phone", "phone_number", "tel"]),
        email: pick(p, ["email"]),
        notes: pick(p, ["message", "notes", "comment", "inquiry"]),
      };
    }
  }
}

export async function handleWebhook(source: LeadSource, request: Request): Promise<Response> {
  const provided = request.headers.get("x-webhook-secret");
  if (!provided) return new Response("Missing x-webhook-secret", { status: 401 });

  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: cfg, error: cfgErr } = await admin.from("webhook_config").select("shared_secret").limit(1).maybeSingle();
  if (cfgErr) return new Response("Server error", { status: 500 });
  if (!cfg?.shared_secret) return new Response("Webhook secret not configured", { status: 503 });

  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(cfg.shared_secret);
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) mismatch |= a[i] ^ b[i];
  if (mismatch !== 0) return new Response("Invalid secret", { status: 401 });

  let payload: unknown;
  try {
    const text = await request.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const norm = normalize(source, payload);
  const { data: inserted, error } = await admin
    .from("leads")
    .insert({
      name: norm.name,
      phone: norm.phone,
      email: norm.email,
      notes: norm.notes,
      source,
      status: "new",
      raw_payload: payload as never,
    })
    .select("id")
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true, lead_id: inserted.id });
}
