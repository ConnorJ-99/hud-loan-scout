import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { Plus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/borrowers/")({
  head: () => ({ meta: [{ title: "Borrower Files — LoanIQ" }] }),
  component: BorrowerList,
});

interface Row {
  id: string;
  borrower_name: string;
  email: string | null;
  phone: string | null;
  loan_purpose: string | null;
  status: string;
  updated_at: string;
}

function BorrowerList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase
      .from("borrower_files")
      .select("id, borrower_name, email, phone, loan_purpose, status, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  async function createNew() {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("borrower_files")
      .insert({ created_by: user.id, borrower_name: "New Borrower", status: "active" })
      .select("id")
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/borrowers/$id" as never, params: { id: data.id } as never });
  }

  return (
    <div>
      <PageHeader
        title="Borrower Files"
        subtitle="Profiles, history, and pipeline"
        actions={
          <button
            onClick={createNew}
            disabled={creating}
            className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20 transition disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            NEW BORROWER
          </button>
        }
      />
      <div className="px-6 py-6 max-w-[1400px]">
        {loading ? (
          <div className="text-mono text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="hud-panel rounded-md p-12 text-center">
            <Users className="h-10 w-10 text-cyan mx-auto mb-3" />
            <div className="text-hud text-cyan mb-1">NO BORROWERS YET</div>
            <p className="text-mono text-xs text-muted-foreground">&gt; Create a borrower file to track loan searches, income analyses, and documents.</p>
          </div>
        ) : (
          <div className="hud-panel rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-panel/60">
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">BORROWER</th>
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">EMAIL</th>
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">PHONE</th>
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">PURPOSE</th>
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">STATUS</th>
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">UPDATED</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-cyan/5 transition">
                    <td className="px-4 py-2.5">
                      <Link
                        to={"/borrowers/$id" as never}
                        params={{ id: r.id } as never}
                        className="text-foreground hover:text-cyan transition"
                      >
                        {r.borrower_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-mono text-xs text-muted-foreground">{r.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-mono text-xs text-muted-foreground">{r.phone ?? "—"}</td>
                    <td className="px-4 py-2.5 text-mono text-xs">{r.loan_purpose ?? "—"}</td>
                    <td className="px-4 py-2.5"><span className="text-hud text-[9px] text-cyan uppercase">{r.status}</span></td>
                    <td className="px-4 py-2.5 text-mono text-[10px] text-muted-foreground">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
