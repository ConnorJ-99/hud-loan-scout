import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { OpsPageHeader } from "@/components/ops/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RefreshCw, Copy, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/admin/webhooks")({
  component: WebhooksPage,
});

const SOURCES = [
  { key: "ghl", label: "GoHighLevel" },
  { key: "zapier", label: "Zapier" },
  { key: "website", label: "Website Form" },
  { key: "zillow", label: "Zillow" },
  { key: "generic", label: "Generic" },
];

function genSecret() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function WebhooksPage() {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [base, setBase] = useState("");

  useEffect(() => { if (typeof window !== "undefined") setBase(window.location.origin); }, []);
  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/" }); }, [loading, isAdmin, navigate]);

  const { data: config } = useQuery({
    queryKey: ["ops-webhook-config"],
    queryFn: async () => (await supabase.from("webhook_config").select("*").limit(1).maybeSingle()).data,
  });

  const rotate = useMutation({
    mutationFn: async () => {
      const newSecret = genSecret();
      if (config?.id) {
        const { error } = await supabase.from("webhook_config").update({ shared_secret: newSecret, updated_by: user?.id ?? null }).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("webhook_config").insert({ shared_secret: newSecret, updated_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Secret rotated"); qc.invalidateQueries({ queryKey: ["ops-webhook-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading…</div>;
  if (!isAdmin) return null;

  const secret = config?.shared_secret ?? "";
  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`${label} copied`); };

  return (
    <div>
      <OpsPageHeader title="Webhook Intake" subtitle="Public endpoints that receive leads from external sources."
        actions={
          <Button size="sm" onClick={() => { if (confirm("Rotate the shared secret? All providers must be updated.")) rotate.mutate(); }}>
            <RefreshCw className="size-4 mr-1" /> {secret ? "Rotate secret" : "Generate secret"}
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Shared secret</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {secret ? (
              <div className="flex gap-2">
                <Input readOnly value={showSecret ? secret : "•".repeat(48)} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => setShowSecret((s) => !s)}>{showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                <Button variant="outline" size="icon" onClick={() => copy(secret, "Secret")}><Copy className="size-4" /></Button>
              </div>
            ) : <p className="text-sm text-muted-foreground">No secret yet. Click "Generate secret" to create one.</p>}
            <p className="text-xs text-muted-foreground">
              Each webhook request must include the header{" "}
              <code className="bg-panel/60 px-1.5 py-0.5 rounded">x-webhook-secret: &lt;the secret above&gt;</code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Endpoint URLs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {SOURCES.map((s) => {
              const url = `${base}/api/public/webhooks/leads/${s.key}`;
              return (
                <div key={s.key}>
                  <Label className="text-xs">{s.label}</Label>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={url} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copy(url, s.label)}><Copy className="size-4" /></Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
