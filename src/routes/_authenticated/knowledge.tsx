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
import { Loader2, Brain, Database, FileText, Plus, Trash2, Pencil, X, MessageSquarePlus } from "lucide-react";
import { extractGuidelines, commitExtraction, type ExtractionResult } from "@/lib/loaniq/knowledge";
import { processLenderNote, type NoteResult } from "@/lib/loaniq/ai";
import { loadCatalogFromDb } from "@/lib/loaniq/dbCatalog";
import { HudHeader } from "@/components/loaniq/HudHeader";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/knowledge")({
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-cyan font-hud">INITIALIZING...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-8 max-w-md text-center hud-corners bg-panel/80">
          <h1 className="font-display text-2xl text-cyan mb-2">ACCESS DENIED</h1>
          <p className="text-sm text-muted-foreground mb-4">
            The Knowledge Expansion Center is restricted to admin users.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Signed in as <span className="text-cyan font-mono">{session?.user.email}</span>
          </p>
          <Link to="/" className="text-cyan text-xs hover:underline">← Back to dashboard</Link>
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
            <TabsTrigger value="notes" className="font-hud tracking-wider">
              <MessageSquarePlus className="h-4 w-4 mr-2" /> QUICK NOTES
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
          <TabsContent value="notes" className="mt-6">
            <QuickNotes />
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
            <p className="text-xs text-muted-foreground font-hud tracking-wider">AWAITING INPUT...</p>
          </div>
        )}
        {analyzing && (
          <div className="flex flex-col items-center justify-center h-[450px] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan" />
            <p className="text-xs text-muted-foreground font-hud tracking-wider">JARVIS PARSING GUIDELINES...</p>
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
                  <p className="text-xs text-muted-foreground mt-1">States: {extraction.lender.states_licensed.join(", ")}</p>
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

// ============ QUICK NOTES ============
function QuickNotes() {
  const [noteText, setNoteText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<NoteResult | null>(null);
  const [applying, setApplying] = useState(false);

  const EXAMPLES = [
    "UWM has the best pricing for FHA, VA, and conventional",
    "Kind Lending is slow on appraisals, usually 10+ days",
    "Equity Prime is great for low FICO VA loans",
    "Click n' Close has aggressive DPA programs for first-time buyers",
  ];

  async function analyze() {
    if (noteText.trim().length < 5) {
      toast.error("Write at least a short note");
      return;
    }
    setProcessing(true);
    setResult(null);
    try {
      const { lenders, products } = await loadCatalogFromDb();
      const catalog = { lenders, products };
      const res = await processLenderNote(noteText, catalog);
      // Defensive normalization — AI sometimes omits arrays
      const normalized: NoteResult = {
        lender_name: res?.lender_name ?? "Unknown",
        note_summary: res?.note_summary ?? noteText,
        tags_to_add: Array.isArray(res?.tags_to_add) ? res.tags_to_add : [],
        programs_affected: Array.isArray(res?.programs_affected) ? res.programs_affected : [],
      };
      // Filter to only programs that actually exist in our catalog (real UUIDs)
      const validIds = new Set(products.map((p) => p.id));
      normalized.programs_affected = normalized.programs_affected.filter(
        (p) => p.product_id && validIds.has(p.product_id),
      );
      setResult(normalized);
      toast.success(`Identified ${normalized.programs_affected.length} program(s) to update for ${normalized.lender_name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  }

  async function applyUpdates() {
    if (!result) return;
    setApplying(true);
    try {
      let updated = 0;
      for (const prog of result.programs_affected) {
        const updates: { tags?: string[]; notes?: string; competitive_advantages?: string } = {};
        const addTags = Array.isArray(prog.add_to_tags) ? prog.add_to_tags : [];
        if (addTags.length > 0) {
          const { data: current } = await supabase
            .from("loan_programs")
            .select("tags")
            .eq("id", prog.product_id)
            .maybeSingle();
          if (current) {
            const existingTags = (current.tags as string[]) || [];
            updates.tags = [...new Set([...existingTags, ...addTags])];
          }
        }
        if (prog.add_to_notes) {
          const { data: current } = await supabase
            .from("loan_programs")
            .select("notes")
            .eq("id", prog.product_id)
            .maybeSingle();
          const existing = (current?.notes as string) || "";
          updates.notes = existing ? `${existing}\n${prog.add_to_notes}` : prog.add_to_notes;
        }
        if (prog.add_to_competitive_advantages) {
          const { data: current } = await supabase
            .from("loan_programs")
            .select("competitive_advantages")
            .eq("id", prog.product_id)
            .maybeSingle();
          const existing = (current?.competitive_advantages as string) || "";
          updates.competitive_advantages = existing
            ? `${existing}; ${prog.add_to_competitive_advantages}`
            : prog.add_to_competitive_advantages;
        }
        if (Object.keys(updates).length > 0) {
          const { error: updErr } = await supabase
            .from("loan_programs")
            .update(updates)
            .eq("id", prog.product_id);
          if (!updErr) updated++;
          else console.warn("Failed updating program", prog.product_id, updErr);
        }
      }

      // Also save the note to ae_notes if we can find the lender
      const { data: lenderMatch } = await supabase
        .from("lenders")
        .select("id")
        .ilike("name", `%${result.lender_name}%`)
        .maybeSingle();
      if (lenderMatch) {
        await supabase.from("ae_notes").insert({
          lender_id: lenderMatch.id,
          note: noteText,
          category: "intel",
        });
      }

      toast.success(`Updated ${updated} program(s) and saved note`);
      setNoteText("");
      setResult(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6 hud-corners bg-panel/80">
        <h3 className="font-hud tracking-wider text-cyan mb-3">QUICK INTEL NOTE</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Type a quick observation about a lender — pricing, speed, quality, quirks. Jarvis will tag the relevant products automatically.
        </p>
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="e.g. UWM has the best pricing for FHA, VA, and conventional..."
          className="min-h-[150px] font-mono text-xs"
          maxLength={2000}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">
            {noteText.length} / 2,000
          </span>
          <Button onClick={analyze} disabled={processing} className="font-hud tracking-widest">
            {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> PROCESSING</> : <><Brain className="h-4 w-4 mr-2" /> PROCESS NOTE</>}
          </Button>
        </div>
        <div className="mt-4">
          <p className="text-[10px] text-muted-foreground font-hud tracking-wider mb-2">EXAMPLES:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setNoteText(ex)}
                className="rounded-sm border border-border bg-panel/40 px-2.5 py-1 text-[10px] text-mono text-muted-foreground hover:border-cyan/60 hover:text-cyan transition"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6 hud-corners bg-panel/80">
        <h3 className="font-hud tracking-wider text-cyan mb-3">AI ANALYSIS</h3>
        {!result && !processing && (
          <div className="flex items-center justify-center h-[250px] border border-dashed border-border rounded">
            <p className="text-xs text-muted-foreground font-hud tracking-wider">TYPE A NOTE TO GET STARTED...</p>
          </div>
        )}
        {processing && (
          <div className="flex flex-col items-center justify-center h-[250px] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan" />
            <p className="text-xs text-muted-foreground font-hud tracking-wider">JARVIS ANALYZING NOTE...</p>
          </div>
        )}
        {result && (
          <div className="space-y-4">
            <div>
              <Badge className="bg-cyan text-background mb-2">LENDER: {result.lender_name}</Badge>
              <p className="text-xs text-muted-foreground">{result.note_summary}</p>
            </div>
            {(result.tags_to_add ?? []).length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground font-hud mb-1">TAGS TO ADD:</p>
                <div className="flex flex-wrap gap-1">
                  {(result.tags_to_add ?? []).map((t) => (
                    <Badge key={t} variant="outline" className="text-[9px] text-cyan border-cyan/50">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground font-hud mb-1">PROGRAMS TO UPDATE ({(result.programs_affected ?? []).length}):</p>
              <div className="space-y-2">
                {(result.programs_affected ?? []).map((p) => (
                  <div key={p.product_id} className="border border-border rounded p-2 bg-background/40 text-xs">
                    <span className="font-mono text-[10px] text-muted-foreground">{p.product_id.slice(0, 8)}...</span>
                    {(p.add_to_tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(p.add_to_tags ?? []).map((t) => (
                          <Badge key={t} variant="outline" className="text-[9px]">+{t}</Badge>
                        ))}
                      </div>
                    )}
                    {p.add_to_competitive_advantages && (
                      <p className="text-[10px] text-cyan/70 italic mt-1">★ {p.add_to_competitive_advantages}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Button
              onClick={applyUpdates}
              disabled={applying}
              className="w-full font-hud tracking-widest bg-cyan text-background hover:bg-cyan/90"
            >
              {applying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> APPLYING</> : <>APPLY UPDATES →</>}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

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
                          {p.notes && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{p.notes}</p>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setEditingProgram(p)} className="text-muted-foreground hover:text-cyan"><Pencil className="h-3 w-3" /></button>
                          <button onClick={() => deleteProgram(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
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
              <p className="text-xs text-muted-foreground font-hud tracking-wider">SELECT A LENDER</p>
            </div>
          )}
        </Card>
      </div>

      {editingLender && <LenderEditModal lender={editingLender} onClose={() => setEditingLender(null)} onSaved={() => { setEditingLender(null); setReload((r) => r + 1); }} />}
      {editingProgram && <ProgramEditModal program={editingProgram} onClose={() => setEditingProgram(null)} onSaved={() => { setEditingProgram(null); setReload((r) => r + 1); }} />}
    </>
  );
}

function LenderEditModal({ lender, onClose, onSaved }: { lender: DbLender; onClose: () => void; onSaved: () => void }) {
  const [l, setL] = useState(lender);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!l.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      if (l.id) {
        const { error } = await supabase.from("lenders").update({
          name: l.name, ae_name: l.ae_name, ae_email: l.ae_email, ae_phone: l.ae_phone,
          website: l.website, states_licensed: l.states_licensed,
          reputation_notes: l.reputation_notes, avg_turn_time_days: l.avg_turn_time_days,
          niche_advantages: l.niche_advantages, internal_experience: l.internal_experience,
        }).eq("id", l.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lenders").insert({
          name: l.name, ae_name: l.ae_name, ae_email: l.ae_email, ae_phone: l.ae_phone,
          website: l.website, states_licensed: l.states_licensed,
          reputation_notes: l.reputation_notes, avg_turn_time_days: l.avg_turn_time_days,
          niche_advantages: l.niche_advantages, internal_experience: l.internal_experience,
        });
        if (error) throw error;
      }
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded border border-input bg-background px-2 py-1.5 text-sm font-mono";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="p-6 w-full max-w-lg hud-corners bg-panel/90 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-hud tracking-wider text-cyan">{l.id ? "EDIT LENDER" : "NEW LENDER"}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-[10px] text-muted-foreground uppercase">Name *</label><input value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] text-muted-foreground uppercase">AE Name</label><input value={l.ae_name ?? ""} onChange={(e) => setL({ ...l, ae_name: e.target.value || null })} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">AE Email</label><input value={l.ae_email ?? ""} onChange={(e) => setL({ ...l, ae_email: e.target.value || null })} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] text-muted-foreground uppercase">AE Phone</label><input value={l.ae_phone ?? ""} onChange={(e) => setL({ ...l, ae_phone: e.target.value || null })} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">Website</label><input value={l.website ?? ""} onChange={(e) => setL({ ...l, website: e.target.value || null })} className={inputCls} /></div>
          </div>
          <div><label className="text-[10px] text-muted-foreground uppercase">States (comma-separated)</label><input value={l.states_licensed.join(", ")} onChange={(e) => setL({ ...l, states_licensed: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={inputCls} /></div>
          <div><label className="text-[10px] text-muted-foreground uppercase">Niche Advantages</label><textarea value={l.niche_advantages ?? ""} onChange={(e) => setL({ ...l, niche_advantages: e.target.value || null })} className={inputCls + " min-h-[60px]"} /></div>
          <div><label className="text-[10px] text-muted-foreground uppercase">Internal Experience</label><textarea value={l.internal_experience ?? ""} onChange={(e) => setL({ ...l, internal_experience: e.target.value || null })} className={inputCls + " min-h-[60px]"} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </Card>
    </div>
  );
}

function ProgramEditModal({ program, onClose, onSaved }: { program: DbProgram; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState(program);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!p.product_name.trim()) { toast.error("Product name required"); return; }
    setSaving(true);
    try {
      if (p.id) {
        const { error } = await supabase.from("loan_programs").update({
          product_name: p.product_name, loan_program: p.loan_program,
          min_fico: p.min_fico, max_ltv: p.max_ltv, max_dti: p.max_dti,
          states: p.states, notes: p.notes,
        }).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loan_programs").insert({
          lender_id: p.lender_id, product_name: p.product_name, loan_program: p.loan_program,
          min_fico: p.min_fico, max_ltv: p.max_ltv, max_dti: p.max_dti,
          states: p.states, notes: p.notes,
        });
        if (error) throw error;
      }
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded border border-input bg-background px-2 py-1.5 text-sm font-mono";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="p-6 w-full max-w-lg hud-corners bg-panel/90 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-hud tracking-wider text-cyan">{p.id ? "EDIT PROGRAM" : "NEW PROGRAM"}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-[10px] text-muted-foreground uppercase">Product Name *</label><input value={p.product_name} onChange={(e) => setP({ ...p, product_name: e.target.value })} className={inputCls} /></div>
          <div><label className="text-[10px] text-muted-foreground uppercase">Loan Program</label><input value={p.loan_program ?? ""} onChange={(e) => setP({ ...p, loan_program: e.target.value || null })} className={inputCls} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[10px] text-muted-foreground uppercase">Min FICO</label><input type="number" value={p.min_fico ?? ""} onChange={(e) => setP({ ...p, min_fico: e.target.value ? Number(e.target.value) : null })} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">Max LTV %</label><input type="number" value={p.max_ltv ?? ""} onChange={(e) => setP({ ...p, max_ltv: e.target.value ? Number(e.target.value) : null })} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase">Max DTI %</label><input type="number" value={p.max_dti ?? ""} onChange={(e) => setP({ ...p, max_dti: e.target.value ? Number(e.target.value) : null })} className={inputCls} /></div>
          </div>
          <div><label className="text-[10px] text-muted-foreground uppercase">States (comma-separated)</label><input value={p.states.join(", ")} onChange={(e) => setP({ ...p, states: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={inputCls} /></div>
          <div><label className="text-[10px] text-muted-foreground uppercase">Notes</label><textarea value={p.notes ?? ""} onChange={(e) => setP({ ...p, notes: e.target.value || null })} className={inputCls + " min-h-[80px]"} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </Card>
    </div>
  );
}

// ============ RAW INTEL ARCHIVE ============
function RawIntelArchive() {
  const [entries, setEntries] = useState<Array<{ id: string; source_label: string | null; status: string; created_at: string; raw_text: string }>>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("raw_intel").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setEntries((data ?? []) as typeof entries);
    });
  }, []);

  const active = entries.find((e) => e.id === selected);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
      <Card className="p-4 hud-corners bg-panel/80">
        <h3 className="font-hud tracking-wider text-cyan mb-3">ENTRIES ({entries.length})</h3>
        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            {entries.map((e) => (
              <div
                key={e.id}
                onClick={() => setSelected(e.id)}
                className={`p-3 rounded border cursor-pointer transition ${
                  selected === e.id ? "border-cyan bg-cyan/10" : "border-border hover:border-cyan/50"
                }`}
              >
                <p className="font-hud text-xs text-foreground truncate">{e.source_label || "Untitled"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(e.created_at).toLocaleDateString()} • {e.status}
                </p>
              </div>
            ))}
            {entries.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No raw intel entries yet.</p>
            )}
          </div>
        </ScrollArea>
      </Card>

      <Card className="p-4 hud-corners bg-panel/80">
        {active ? (
          <ScrollArea className="h-[600px]">
            <h3 className="font-hud tracking-wider text-cyan mb-2">{active.source_label || "Untitled"}</h3>
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">{active.raw_text}</pre>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-xs text-muted-foreground font-hud tracking-wider">SELECT AN ENTRY</p>
          </div>
        )}
      </Card>
    </div>
  );
}
