import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Returns YYYY-MM-DD for the most recent pay-period start <= today,
// based on the staff member's frequency and pay_day.
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
    const second = first + 15;
    if (d >= second) return fmt(new Date(Date.UTC(y, m, second)));
    if (d >= first) return fmt(new Date(Date.UTC(y, m, first)));
    return fmt(new Date(Date.UTC(y, m - 1, second)));
  }
  if (freq === "biweekly") {
    // Anchor: 2024-01-05 (Friday). Period start = most recent Friday on a 14-day cycle.
    const anchor = Date.UTC(2024, 0, 5);
    const todayUTC = Date.UTC(y, m, d);
    const days = Math.floor((todayUTC - anchor) / 86400000);
    const offset = ((days % 14) + 14) % 14;
    return fmt(new Date(todayUTC - offset * 86400000));
  }
  if (freq === "weekly") {
    // Period start = most recent Friday (day 5)
    const dow = today.getUTCDay();
    const offset = (dow - 5 + 7) % 7;
    const start = new Date(Date.UTC(y, m, d - offset));
    return fmt(start);
  }
  return null;
}

export const Route = createFileRoute("/api/public/hooks/auto-payroll")({
  server: {
    handlers: {
      POST: async () => {
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return new Response(JSON.stringify({ error: "Server not configured" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        const supabase = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, pay_frequency, pay_day, monthly_salary, monthly_draw, comp_plan");
        if (pErr) {
          return new Response(JSON.stringify({ error: pErr.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        const today = new Date();
        let created = 0;
        const skipped: { user_id: string; reason: string }[] = [];

        for (const p of profiles ?? []) {
          const monthlySalary = Number(p.monthly_salary ?? 0);
          const monthlyDraw = Number(p.monthly_draw ?? 0);
          if (monthlySalary <= 0 && monthlyDraw <= 0) {
            skipped.push({ user_id: p.user_id, reason: "no_salary_or_draw" });
            continue;
          }
          const freq = (p.pay_frequency as string) || "monthly";
          const period = periodStartFor(freq, p.pay_day ?? null, today);
          if (!period) {
            skipped.push({ user_id: p.user_id, reason: "no_period" });
            continue;
          }
          // Per-period amounts (split monthly totals by frequency)
          const divisor = freq === "weekly" ? 4 : freq === "biweekly" ? 2 : freq === "semimonthly" ? 2 : 1;
          const salary = +(monthlySalary / divisor).toFixed(2);
          const draw = +(monthlyDraw / divisor).toFixed(2);

          // Upsert by (user_id, pay_period) — unique index ensures idempotency
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
          if (error) {
            skipped.push({ user_id: p.user_id, reason: error.message });
          } else {
            created++;
          }
        }

        return new Response(
          JSON.stringify({ ok: true, created, skipped, ran_at: today.toISOString() }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
