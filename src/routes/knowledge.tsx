import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Brain, Database, FileText, Plus, Trash2, Pencil, X } from "lucide-react";
import { extractGuidelines, commitExtraction, type ExtractionResult } from "@/lib/loaniq/knowledge";
import { HudHeader } from "@/components/loaniq/HudHeader";
import { z } from "zod";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "LoanIQ — Knowledge Expansion Center" },
      { name: "description", content: "Paste lender guidelines and let Jarvis extract structured intelligence." },
    ],
  }),
  component: KnowledgePage,
});

interface DbLender {
  id: string;
  name: string;
  ae_name: string | null;
  ae_email: string | null;
  ae_phone: string | null;
  website: string | null;
  states_licensed: string[];
  reputation_notes: string | null;
  avg_turn_time_days: number | null;
  niche_advantages: string | null;
  internal_experience: string | null;
}

interface DbProgram {
  id: string;
  lender_id: string;
  product_name: string;
  loan_program: string | null;
  min_fico: number | null;
  max_ltv: number | null;
  max_dti: number | null;
  states: string[];
  notes: string | null;
}

function KnowledgePage() {
  const { loading, isAdmin, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-cyan font-hud">INITIALIZING...</div>;
  }

  if (!session) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-8 max-w-md text-center hud-corners bg-panel/80">
          <h1 className="font-display text-2xl text-cyan mb-2">ACCESS DENIED</h1>
          <p className="text-sm text-muted-foreground mb-4">
            The Knowledge Expansion Center is restricted to admin users.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Signed in as <span className="text-cyan font-mono">{session.user.email}</span>
          </p>
          <Link to="/" className="text-cyan text-xs hover:underline">← Back to scanner</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <HudHeader />
      <main className="relative z-10 mx-auto max-w-[1800px] px-6 py-6">
        <div className="mb-6">
          <h1 className="font-display text-3xl tracking-widest text-cyan glow-text">
            KNOWLEDGE EXPANSION CENTER
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-1">
            Continuous Intelligence Acquisition // Jarvis Learning Module
          </p>
        </div>

        <Tabs defaultValue="paste" className="w-full">
          <TabsList className="bg-panel border border-border">
            <TabsTrigger value="paste" className="font-hud tracking-wider">
              <Brain className="h-4 w-4 mr-2" /> PASTE & LEARN
            </TabsTrigger>
            <TabsTrigger value="manual" className="font-hud tracking-wider">
              <Database className="h-4 w-4 mr-2" /> MANUAL BUILDER
            </TabsTrigger>
            <TabsTrigger value="archive" className="font-hud tracking-wider">
              <FileText className="h-4 w-4 mr-2" /> RAW INTEL ARCHIVE
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="mt-6">
            <PasteAndLearn />
          </TabsContent>
          <TabsContent value="manual" className="mt-6">
            <ManualBuilder />
          </TabsContent>
          <TabsContent value="archive" className="mt-6">
            <RawIntelArchive />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster theme="dark" />
    </div>
  );
}

// ============ PASTE AND LEARN ============
const sourceLabelSchema = z.string().trim().min(1).max(200);

function PasteAndLearn() {
  const [rawText, setRawText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [committing, setCommitting] = useState(false);

  async function analyze() {
    if (rawText.trim().length < 30) {
      toast.error("Paste at least 30 characters of guideline content");
      return;
    }
    setAnalyzing(true);
    setExtraction(null);
    try {
      const result = await extractGuidelines(rawText);
      setExtraction(result);
      toast.success(`Extracted ${result.programs.length} program(s) from ${result.lender.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function commit() {
    if (!extraction) return;
    const labelParse = sourceLabelSchema.safeParse(sourceLabel || `Pasted ${new Date().toLocaleString()}`);
    if (!labelParse.success) {
      toast.error("Source label must be 1-200 characters");
      return;
    }
    setCommitting(true);
    try {
      const { programIds } = await commitExtraction(extraction, rawText, labelParse.data);
      toast.success(`Saved ${programIds.length} program(s) to catalog`);
      setRawText("");
      setSourceLabel("");
      setExtraction(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6 hud-corners bg-panel/80">
        <h3 className="font-hud tracking-wider text-cyan mb-3">RAW INPUT</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Paste lender matrices, guideline PDFs, AE emails, broker bulletins, overlay updates, or any unstructured loan intelligence.
        </p>
        <Input
          placeholder="Source label (e.g., 'AE Email 4/17 - Kind Lending')"
          value={sourceLabel}
          onChange={(e) => setSourceLabel(e.target.value)}
          maxLength={200}
          className="mb-3 font-mono text-xs"
        />
        <Textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste guideline text here..."
          className="min-h-[400px] font-mono text-xs"
          maxLength={50000}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">
            {rawText.length.toLocaleString()} / 50,000 chars
          </span>
          <Button onClick={analyze} disabled={analyzing} className="font-hud tracking-widest">
            {analyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> ANALYZING</> : <><Brain className="h-4 w-4 mr-2" /> EXTRACT INTEL</>}
          </Button>
        </div>
      </Card>

      <Card className="p-6 hud-corners bg-panel/80">
        <h3 className="font-hud tracking-wider text-cyan mb-3">STRUCTURED EXTRACTION</h3>
        {!extraction && !analyzing && (
          <div className="flex items-center justify-center h-[450px] border border-dashed border-border rounded">
            <p className="text-xs text-muted-foreground font-hud tracking-wider">
              AWAITING INPUT...
            </p>
          </div>
        )}
        {analyzing && (
          <div className="flex flex-col items-center justify-center h-[450px] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan" />
            <p className="text-xs text-muted-foreground font-hud tracking-wider">
              JARVIS PARSING GUIDELINES...
            </p>
          </div>
        )}
        {extraction && (
          <ScrollArea className="h-[450px] pr-3">
            <div className="space-y-4">
              <div>
                <Badge className="bg-cyan text-background mb-2">LENDER</Badge>
                <h4 className="font-display text-lg text-cyan">{extraction.lender.name}</h4>
                {extraction.lender.ae_name && (
                  <p className="text-xs text-muted-foreground">AE: {extraction.lender.ae_name} {extraction.lender.ae_email && `• ${extraction.lender.ae_email}`}</p>
                )}
                {extraction.lender.states_licensed.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    States: {extraction.lender.states_licensed.join(", ")}
                  </p>
                )}
                {extraction.lender.niche_advantages && (
                  <p className="text-xs text-cyan/80 mt-1 italic">★ {extraction.lender.niche_advantages}</p>
                )}
              </div>

              <div>
                <Badge className="bg-blue-accent text-background mb-2">PROGRAMS ({extraction.programs.length})</Badge>
                <div className="space-y-3">
                  {extraction.programs.map((p, i) => (
                    <div key={i} className="border border-border rounded p-3 bg-background/40">
                      <h5 className="font-hud text-sm text-foreground">{p.product_name}</h5>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px] font-mono text-muted-foreground">
                        {p.min_fico !== null && <span>FICO ≥ <span className="text-cyan">{p.min_fico}</span></span>}
                        {p.max_ltv !== null && <span>LTV ≤ <span className="text-cyan">{p.max_ltv}%</span></span>}
                        {p.max_dti !== null && <span>DTI ≤ <span className="text-cyan">{p.max_dti}%</span></span>}
                        {p.dscr_min !== null && <span>DSCR ≥ <span className="text-cyan">{p.dscr_min}</span></span>}
                        {p.reserve_months !== null && <span>Reserves: <span className="text-cyan">{p.reserve_months}mo</span></span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.dpa_available && <Badge variant="outline" className="text-[9px]">DPA</Badge>}
                        {p.foreign_national_eligible && <Badge variant="outline" className="text-[9px]">FN</Badge>}
                        {p.itin_eligible && <Badge variant="outline" className="text-[9px]">ITIN</Badge>}
                        {p.gift_funds_allowed && <Badge variant="outline" className="text-[9px]">GIFT</Badge>}
                        {p.tags.map((t) => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}
                      </div>
                      {p.competitive_advantages && (
                        <p className="text-[10px] text-cyan/70 italic mt-2">★ {p.competitive_advantages}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {extraction.overlays.length > 0 && (
                <div>
                  <Badge className="bg-warn text-background mb-2">OVERLAYS</Badge>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {extraction.overlays.map((o, i) => (
                      <li key={i}><span className="text-warn font-mono">[{o.overlay_type}]</span> {o.description}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-3 border-t border-border">
                <Button
                  onClick={commit}
                  disabled={committing}
                  className="w-full font-hud tracking-widest bg-cyan text-background hover:bg-cyan/90"
                >
                  {committing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> COMMITTING</> : <>COMMIT TO KNOWLEDGE BASE →</>}
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}

// ============ MANUAL BUILDER ============
function ManualBuilder() {
  const [lenders, setLenders] = useState<DbLender[]>([]);
  const [programs, setPrograms] = useState<DbProgram[]>([]);
  const [activeLenderId, setActiveLenderId] = useState<string | null>(null);
  const [editingLender, setEditingLender] = useState<DbLender | null>(null);
  const [editingProgram, setEditingProgram] = useState<DbProgram | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from("lenders").select("*").order("name"),
      supabase.from("loan_programs").select("*").order("product_name"),
    ]).then(([l, p]) => {
      setLenders((l.data ?? []) as DbLender[]);
      setPrograms((p.data ?? []) as DbProgram[]);
    });
  }, [reload]);

  async function deleteLender(id: string) {
    if (!confirm("Delete this lender and all its programs?")) return;
    const { error } = await supabase.from("lenders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Lender deleted"); setReload((r) => r + 1); }
  }

  async function deleteProgram(id: string) {
    if (!confirm("Delete this program?")) return;
    const { error } = await supabase.from("loan_programs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Program deleted"); setReload((r) => r + 1); }
  }

  const filteredPrograms = activeLenderId ? programs.filter((p) => p.lender_id === activeLenderId) : [];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        <Card className="p-4 hud-corners bg-panel/80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-hud tracking-wider text-cyan">LENDERS ({lenders.length})</h3>
            <Button size="sm" onClick={() => setEditingLender({ id: "", name: "", ae_name: null, ae_email: null, ae_phone: null, website: null, states_licensed: [], reputation_notes: null, avg_turn_time_days: null, niche_advantages: null, internal_experience: null })}>
              <Plus className="h-3 w-3 mr-1" /> NEW
            </Button>
          </div>
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {lenders.map((l) => (
                <div
                  key={l.id}
                  onClick={() => setActiveLenderId(l.id)}
                  className={`p-3 rounded border cursor-pointer transition ${
                    activeLenderId === l.id ? "border-cyan bg-cyan/10" : "border-border hover:border-cyan/50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-hud text-sm text-foreground truncate">{l.name}</p>
                      {l.ae_name && <p className="text-[10px] text-muted-foreground truncate">AE: {l.ae_name}</p>}
                      <p className="text-[10px] text-muted-foreground">
                        {programs.filter((p) => p.lender_id === l.id).length} programs
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setEditingLender(l); }} className="text-muted-foreground hover:text-cyan">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteLender(l.id); }} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {lenders.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No lenders yet. Use Paste & Learn or click NEW.</p>
              )}
            </div>
          </ScrollArea>
        </Card>

        <Card className="p-4 hud-corners bg-panel/80">
          {activeLenderId ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-hud tracking-wider text-cyan">PROGRAMS ({filteredPrograms.length})</h3>
                <Button size="sm" onClick={() => setEditingProgram({ id: "", lender_id: activeLenderId, product_name: "", loan_program: null, min_fico: null, max_ltv: null, max_dti: null, states: [], notes: null })}>
                  <Plus className="h-3 w-3 mr-1" /> NEW PROGRAM
                </Button>
              </div>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {filteredPrograms.map((p) => (
                    <div key={p.id} className="p-3 border border-border rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-hud text-sm text-foreground">{p.product_name}</p>
                          {p.loan_program && <p className="text-[10px] text-muted-foreground">{p.loan_program}</p>}
                          <div className="text-[11px] font-mono text-muted-foreground mt-1 flex gap-3">
                            {p.min_fico !== null && <span>FICO ≥ {p.min_fico}</span>}
                            {p.max_ltv !== null && <span>LTV ≤ {p.max_ltv}%</span>}
                            {p.max_dti !== null && <span>DTI ≤ {p.max_dti}%</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setEditingProgram(p)} className="text-muted-foreground hover:text-cyan">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => deleteProgram(p.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredPrograms.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">No programs for this lender.</p>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex items-center justify-center h-[600px]">
              <p className="text-xs text-muted-foreground font-hud tracking-wider">SELECT A LENDER →</p>
            </div>
          )}
        </Card>
      </div>

      {editingLender && (
        <LenderEditModal
          lender={editingLender}
          onClose={() => setEditingLender(null)}
          onSaved={() => { setEditingLender(null); setReload((r) => r + 1); }}
        />
      )}
      {editingProgram && (
        <ProgramEditModal
          program={editingProgram}
          onClose={() => setEditingProgram(null)}
          onSaved={() => { setEditingProgram(null); setReload((r) => r + 1); }}
        />
      )}
    </>
  );
}

function LenderEditModal({ lender, onClose, onSaved }: { lender: DbLender; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(lender);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        ae_name: form.ae_name,
        ae_email: form.ae_email,
        ae_phone: form.ae_phone,
        website: form.website,
        states_licensed: form.states_licensed,
        reputation_notes: form.reputation_notes,
        avg_turn_time_days: form.avg_turn_time_days,
        niche_advantages: form.niche_advantages,
        internal_experience: form.internal_experience,
      };
      const { error } = lender.id
        ? await supabase.from("lenders").update(payload).eq("id", lender.id)
        : await supabase.from("lenders").insert([payload]);
      if (error) throw error;
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-6 hud-corners bg-panel max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display text-xl text-cyan">{lender.id ? "EDIT" : "NEW"} LENDER</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="AE Name"><Input value={form.ae_name ?? ""} onChange={(e) => setForm({ ...form, ae_name: e.target.value || null })} maxLength={200} /></Field>
            <Field label="AE Email"><Input value={form.ae_email ?? ""} onChange={(e) => setForm({ ...form, ae_email: e.target.value || null })} maxLength={255} /></Field>
            <Field label="AE Phone"><Input value={form.ae_phone ?? ""} onChange={(e) => setForm({ ...form, ae_phone: e.target.value || null })} maxLength={50} /></Field>
            <Field label="Website"><Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value || null })} maxLength={500} /></Field>
          </div>
          <Field label="States Licensed (comma-separated, e.g. CA,TX,FL or ALL)">
            <Input
              value={form.states_licensed.join(",")}
              onChange={(e) => setForm({ ...form, states_licensed: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) })}
            />
          </Field>
          <Field label="Avg Turn Time (days)">
            <Input
              type="number"
              value={form.avg_turn_time_days ?? ""}
              onChange={(e) => setForm({ ...form, avg_turn_time_days: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label="Niche Advantages"><Textarea value={form.niche_advantages ?? ""} onChange={(e) => setForm({ ...form, niche_advantages: e.target.value || null })} maxLength={2000} /></Field>
          <Field label="Reputation Notes"><Textarea value={form.reputation_notes ?? ""} onChange={(e) => setForm({ ...form, reputation_notes: e.target.value || null })} maxLength={2000} /></Field>
          <Field label="Internal Team Experience"><Textarea value={form.internal_experience ?? ""} onChange={(e) => setForm({ ...form, internal_experience: e.target.value || null })} maxLength={2000} /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>CANCEL</Button>
          <Button onClick={save} disabled={saving} className="bg-cyan text-background hover:bg-cyan/90">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}SAVE
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ProgramEditModal({ program, onClose, onSaved }: { program: DbProgram; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(program);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.product_name.trim()) { toast.error("Product name required"); return; }
    setSaving(true);
    try {
      const payload = {
        lender_id: form.lender_id,
        product_name: form.product_name.trim(),
        loan_program: form.loan_program,
        min_fico: form.min_fico,
        max_ltv: form.max_ltv,
        max_dti: form.max_dti,
        states: form.states,
        notes: form.notes,
      };
      const { error } = program.id
        ? await supabase.from("loan_programs").update(payload).eq("id", program.id)
        : await supabase.from("loan_programs").insert([payload]);
      if (error) throw error;
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-6 hud-corners bg-panel max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display text-xl text-cyan">{program.id ? "EDIT" : "NEW"} PROGRAM</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Product Name *"><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} maxLength={200} /></Field>
          <Field label="Loan Program"><Input value={form.loan_program ?? ""} onChange={(e) => setForm({ ...form, loan_program: e.target.value || null })} maxLength={200} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Min FICO"><Input type="number" value={form.min_fico ?? ""} onChange={(e) => setForm({ ...form, min_fico: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Max LTV %"><Input type="number" value={form.max_ltv ?? ""} onChange={(e) => setForm({ ...form, max_ltv: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Max DTI %"><Input type="number" value={form.max_dti ?? ""} onChange={(e) => setForm({ ...form, max_dti: e.target.value ? Number(e.target.value) : null })} /></Field>
          </div>
          <Field label="States (comma-separated, ALL for nationwide)">
            <Input
              value={form.states.join(",")}
              onChange={(e) => setForm({ ...form, states: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) })}
            />
          </Field>
          <Field label="Notes"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} maxLength={4000} /></Field>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Tip: For full guideline detail (DSCR, ITIN, BK seasoning, overlays, etc.) use the Paste & Learn extractor.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>CANCEL</Button>
          <Button onClick={save} disabled={saving} className="bg-cyan text-background hover:bg-cyan/90">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}SAVE
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-hud">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ============ RAW INTEL ARCHIVE ============
interface RawIntelRow {
  id: string;
  source_label: string | null;
  raw_text: string;
  status: string;
  created_at: string;
  lender_id: string | null;
}

function RawIntelArchive() {
  const [items, setItems] = useState<RawIntelRow[]>([]);
  const [selected, setSelected] = useState<RawIntelRow | null>(null);

  useEffect(() => {
    supabase
      .from("raw_intel")
      .select("id, source_label, raw_text, status, created_at, lender_id")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setItems((data ?? []) as RawIntelRow[]));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      <Card className="p-4 hud-corners bg-panel/80">
        <h3 className="font-hud tracking-wider text-cyan mb-3">ARCHIVE ({items.length})</h3>
        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            {items.map((it) => (
              <div
                key={it.id}
                onClick={() => setSelected(it)}
                className={`p-3 rounded border cursor-pointer transition ${
                  selected?.id === it.id ? "border-cyan bg-cyan/10" : "border-border hover:border-cyan/50"
                }`}
              >
                <p className="font-hud text-xs text-foreground truncate">{it.source_label ?? "Unlabeled"}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{new Date(it.created_at).toLocaleString()}</p>
                <Badge variant="outline" className="text-[9px] mt-1">{it.status}</Badge>
              </div>
            ))}
            {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No archived intel yet.</p>}
          </div>
        </ScrollArea>
      </Card>

      <Card className="p-4 hud-corners bg-panel/80">
        {selected ? (
          <>
            <h3 className="font-hud tracking-wider text-cyan mb-3">{selected.source_label}</h3>
            <ScrollArea className="h-[600px]">
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">{selected.raw_text}</pre>
            </ScrollArea>
          </>
        ) : (
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-xs text-muted-foreground font-hud tracking-wider">SELECT AN ENTRY →</p>
          </div>
        )}
      </Card>
    </div>
  );
}
