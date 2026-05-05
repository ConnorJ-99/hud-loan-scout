import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function periodStartFor(freq: string, payDay: number | null, today: Date): string | null {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  const fmt = (date: Date) => date.toISOString().slice(0, 10);

  if (freq === "monthly") {
    const day = Math.min(Math.max(payDay ?? 1, 1), 28);
    if (d >= day) return fmt(new Date(Date.UTC(y, m, day)));
    return fmt(new Date(Date.UTC(y, m - 1, day)));
  }
  if (freq === "semimonthly") {
    const first = Math.min(Math.max(payDay ?? 1, 1), 15);
    const second = Math.min(first + 15, 28);
    if (d >= second) return fmt(new Date(Date.UTC(y, m, second)));
    if (d >= first) return fmt(new Date(Date.UTC(y, m, first)));
    return fmt(new Date(Date.UTC(y, m - 1, second)));
  }
  if (freq === "biweekly") {
    const anchor = Date.UTC(2024, 0, 5);
    const todayUTC = Date.UTC(y, m, d);
    const days = Math.floor((todayUTC - anchor) / 86400000);
    const offset = ((days % 14) + 14) % 14;
    return fmt(new Date(todayUTC - offset * 86400000));
  }
  if (freq === "weekly") {
    const dow = today.getUTCDay();
    const offset = (dow - 5 + 7) % 7;
    return fmt(new Date(Date.UTC(y, m, d - offset)));
  }
  return null;
}

function periodsPerYear(freq: string): number {
  switch (freq) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "semimonthly":
      return 24;
    default:
      return 12;
  }
}

export const Route = createFileRoute("/api/public/hooks/auto-payroll")({
  server: {
    handlers: {
      POST: async () => {
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return new Response(JSON.stringify({ error: "Server not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, pay_frequency, pay_day, annual_salary, annual_draw, monthly_salary, monthly_draw, comp_plan");
        if (pErr) {
          return new Response(JSON.stringify({ error: pErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const today = new Date();
        let created = 0;
        const skipped: { user_id: string; reason: string }[] = [];

        for (const p of profiles ?? []) {
          const freq = (p.pay_frequency as string) || "monthly";
          const annualSalary = Number(p.annual_salary ?? 0) || Number(p.monthly_salary ?? 0) * 12;
          const annualDraw = Number(p.annual_draw ?? 0) || Number(p.monthly_draw ?? 0) * 12;
          if (annualSalary <= 0 && annualDraw <= 0) {
            skipped.push({ user_id: p.user_id, reason: "no_salary_or_draw" });
            continue;
          }

          const period = periodStartFor(freq, p.pay_day ?? null, today);
          if (!period) {
            skipped.push({ user_id: p.user_id, reason: "no_period" });
            continue;
          }

          const periods = periodsPerYear(freq);
          const salary = +(annualSalary / periods).toFixed(2);
          const draw = +(annualDraw / periods).toFixed(2);

          const { error } = await supabase.from("salary_payouts").upsert(
            {
              user_id: p.user_id,
              pay_period: period,
              salary_amount: salary,
              draw_amount: draw,
              paid_on: null,
              notes: `Auto-generated (${freq})`,
            },
            { onConflict: "user_id,pay_period", ignoreDuplicates: true },
          );

          if (error) skipped.push({ user_id: p.user_id, reason: error.message });
          else created++;
        }

        return new Response(JSON.stringify({ ok: true, created, skipped, ran_at: today.toISOString() }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
