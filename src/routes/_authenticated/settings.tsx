import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — LoanIQ" }] }),
  component: Settings,
});

interface Setting {
  default_expense_factor: number;
  large_deposit_threshold: number;
  company_name: string | null;
  company_logo_url: string | null;
}

const inputCls = "w-full rounded-sm border border-input bg-background/60 px-2.5 py-1.5 text-sm text-mono outline-none focus:border-cyan transition";

function Settings() {
  const { user, isAdmin } = useAuth();
  const [s, setS] = useState<Setting>({
    default_expense_factor: 0.5,
    large_deposit_threshold: 5000,
    company_name: "MPS Mortgage",
    company_logo_url: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("app_settings").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setS({
          default_expense_factor: Number(data.default_expense_factor),
          large_deposit_threshold: Number(data.large_deposit_threshold),
          company_name: data.company_name,
          company_logo_url: data.company_logo_url,
        });
      }
      setLoading(false);
    });
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({
      user_id: user.id,
      default_expense_factor: s.default_expense_factor,
      large_deposit_threshold: s.large_deposit_threshold,
      company_name: s.company_name,
      company_logo_url: s.company_logo_url,
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Profile, defaults, and report branding"
        actions={
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20 transition disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} SAVE
          </button>
        }
      />
      <div className="px-6 py-6 max-w-[900px] space-y-5">
        <section className="hud-panel rounded-md p-4">
          <div className="text-hud text-xs text-cyan mb-3">USER PROFILE</div>
          <div className="text-mono text-xs text-muted-foreground">{user?.email}</div>
          {isAdmin && <div className="text-hud text-[10px] text-success mt-1">// ADMIN ROLE</div>}
        </section>

        <section className="hud-panel rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2 text-hud text-xs text-cyan">INCOME ANALYZER DEFAULTS</div>
          <Field label="Default Expense Factor">
            <select className={inputCls} disabled={loading} value={String(s.default_expense_factor)} onChange={(e) => setS({ ...s, default_expense_factor: Number(e.target.value) })}>
              <option value="0.5">50%</option>
              <option value="0.6">60%</option>
              <option value="0.7">70%</option>
              <option value="1">100%</option>
            </select>
          </Field>
          <Field label="Large Deposit Threshold $">
            <input type="number" className={inputCls} disabled={loading} value={s.large_deposit_threshold} onChange={(e) => setS({ ...s, large_deposit_threshold: Number(e.target.value) })} />
          </Field>
        </section>

        <section className="hud-panel rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2 text-hud text-xs text-cyan">REPORT BRANDING</div>
          <Field label="Company Name"><input className={inputCls} disabled={loading} value={s.company_name ?? ""} onChange={(e) => setS({ ...s, company_name: e.target.value })} /></Field>
          <Field label="Logo URL"><input className={inputCls} disabled={loading} value={s.company_logo_url ?? ""} onChange={(e) => setS({ ...s, company_logo_url: e.target.value })} /></Field>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-hud text-[10px] text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
