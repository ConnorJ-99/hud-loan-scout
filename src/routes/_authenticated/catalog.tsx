import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { HudHeader } from "@/components/loaniq/HudHeader";
import { loadCatalogFromDb } from "@/lib/loaniq/dbCatalog";
import { extractGuidelines, commitExtraction } from "@/lib/loaniq/knowledge";
import type { Lender, LenderProduct, IncomeType, LoanType, PropertyType, Occupancy, SpecialNeed } from "@/lib/loaniq/types";
import { Plus, Pencil, Trash2, X, Upload, FileText, Loader2, ChevronRight } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({
    meta: [
      { title: "Lender & Product Catalog — LoanIQ" },
      { name: "description", content: "Manage your lender and product database." },
      { property: "og:title", content: "Lender & Product Catalog — LoanIQ" },
      { property: "og:description", content: "Add lenders, define product guidelines, import via CSV or paste." },
    ],
  }),
  component: CatalogPage,
});

const INCOME_TYPES: IncomeType[] = ["W2", "Self-Employed 1099", "Bank Statement", "DSCR/No-Doc", "Retired/Asset Depletion"];
const LOAN_TYPES: LoanType[] = ["FHA", "VA", "USDA", "Conventional", "Jumbo", "Non-QM", "DSCR", "Hard Money", "Bridge"];
const PROP_TYPES: PropertyType[] = ["SFR", "Condo", "2-4 Unit", "5+ Unit Multifamily", "Mixed Use", "Commercial"];
const OCCUPANCIES: Occupancy[] = ["Primary", "Second Home", "Investment"];
const SPECIAL: SpecialNeed[] = ["Gift funds", "Co-borrower", "Foreign National", "ITIN", "First-Time Buyer", "Manufactured Home"];

const inputCls = "w-full rounded-sm border border-input bg-background/60 px-2.5 py-1.5 text-sm text-mono outline-none focus:border-cyan transition";

function CatalogPage() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [products, setProducts] = useState<LenderProduct[]>([]);
  const [activeLender, setActiveLender] = useState<string | null>(null);
  const [editingLender, setEditingLender] = useState<Lender | null>(null);
  const [editingProduct, setEditingProduct] = useState<LenderProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<LenderProduct | null>(null);

  // Paste-to-import state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteAnalyzing, setPasteAnalyzing] = useState(false);

  const reload = () => {
    setLoading(true);
    setLoadError(null);
    loadCatalogFromDb()
      .then(({ lenders, products }) => {
        setLenders(lenders);
        setProducts(products);
      })
      .catch((e) => setLoadError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const productsByLender = useMemo(() => {
    const m: Record<string, LenderProduct[]> = {};
    for (const p of products) (m[p.lenderId] ||= []).push(p);
    return m;
  }, [products]);

  const lenderById = useMemo(() => Object.fromEntries(lenders.map((l) => [l.id, l])), [lenders]);

  const handlePasteImport = async () => {
    if (pasteText.trim().length < 30) {
      toast.error("Paste at least 30 characters of guideline content");
      return;
    }
    setPasteAnalyzing(true);
    try {
      const extraction = await extractGuidelines(pasteText);
      toast.success(`Extracted ${extraction.programs.length} program(s) from ${extraction.lender.name}`);
      const { programIds } = await commitExtraction(extraction, pasteText, `Catalog paste ${new Date().toLocaleString()}`);
      toast.success(`Saved ${programIds.length} program(s) to catalog`);
      setPasteText("");
      setShowPasteModal(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setPasteAnalyzing(false);
    }
  };

  const saveLender = (l: Lender) => {
    const exists = lenders.find((x) => x.id === l.id);
    const next = exists ? lenders.map((x) => (x.id === l.id ? l : x)) : [...lenders, l];
    setLenders(next);
    setEditingLender(null);
    toast.success(exists ? "Lender updated" : "Lender added");
  };

  const deleteLender = (id: string) => {
    if (!confirm("Delete lender and all its products?")) return;
    setLenders((prev) => prev.filter((l) => l.id !== id));
    setProducts((prev) => prev.filter((p) => p.lenderId !== id));
    if (activeLender === id) setActiveLender(null);
  };

  const saveProduct = (p: LenderProduct) => {
    const exists = products.find((x) => x.id === p.id);
    const next = exists ? products.map((x) => (x.id === p.id ? p : x)) : [...products, p];
    setProducts(next);
    setEditingProduct(null);
    toast.success(exists ? "Product updated" : "Product added");
  };

  const deleteProduct = (id: string) => {
    if (!confirm("Delete product?")) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const newLender = () => setEditingLender({
    id: `lndr_${Date.now()}`, name: "", aeName: "", aeEmail: "", aePhone: "", website: "", statesLicensed: ["ALL"],
  });

  const newProduct = (lenderId: string) => setEditingProduct({
    id: `prd_${Date.now()}`, lenderId, productName: "",
    minFico: 620, maxLtv: 95, maxDti: 50,
    incomeTypesAllowed: ["W2"], propertyTypesAllowed: ["SFR"], loanTypes: ["Conventional"],
    dpaAvailable: false, giftFundsAllowed: true, occupancies: ["Primary"],
    states: ["ALL"], specialPrograms: [], notes: "", tags: [],
  });

  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const lines = text.trim().split("\n");
    const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
    let added = 0;
    const next: LenderProduct[] = [...products];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const row: Record<string, string> = {};
      header.forEach((h, j) => { row[h] = (cols[j] ?? "").trim(); });
      if (!row.lenderid || !row.productname) continue;
      next.push({
        id: `prd_${Date.now()}_${i}`,
        lenderId: row.lenderid,
        productName: row.productname,
        minFico: Number(row.minfico) || 620,
        maxLtv: Number(row.maxltv) || 95,
        maxDti: Number(row.maxdti) || 50,
        incomeTypesAllowed: (row.incometypes ?? "W2").split("|") as IncomeType[],
        propertyTypesAllowed: (row.propertytypes ?? "SFR").split("|") as PropertyType[],
        loanTypes: (row.loantypes ?? "Conventional").split("|") as LoanType[],
        dpaAvailable: row.dpaavailable === "true",
        dpaMinFico: row.dpaminfico ? Number(row.dpaminfico) : undefined,
        giftFundsAllowed: row.giftfunds !== "false",
        occupancies: (row.occupancies ?? "Primary").split("|") as Occupancy[],
        states: (row.states ?? "ALL").split("|"),
        specialPrograms: (row.specialprograms ?? "").split("|").filter(Boolean) as SpecialNeed[],
        notes: row.notes ?? "",
        tags: (row.tags ?? "").split("|").filter(Boolean),
      });
      added++;
    }
    setProducts(next);
    e.target.value = "";
    toast.success(`Imported ${added} products`);
  };

  return (
    <div className="min-h-screen">
      <HudHeader />
      <main className="relative z-10 mx-auto max-w-[1800px] px-6 py-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-display text-2xl text-cyan glow-cyan">LENDER CATALOG</h1>
            <p className="text-xs text-mono text-muted-foreground">// {lenders.length} lenders · {products.length} products in database</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowPasteModal(true)} className="flex items-center gap-2 rounded-sm border border-border bg-panel/60 px-3 py-2 text-hud text-xs text-muted-foreground hover:border-cyan/60 hover:text-cyan transition">
              <FileText className="h-3.5 w-3.5" /> Paste Guidelines
            </button>
            <label className="cursor-pointer flex items-center gap-2 rounded-sm border border-border bg-panel/60 px-3 py-2 text-hud text-xs text-muted-foreground hover:border-cyan/60 hover:text-cyan transition">
              <Upload className="h-3.5 w-3.5" /> Import CSV
              <input type="file" accept=".csv" onChange={handleCsv} className="hidden" />
            </label>
            <button onClick={newLender} className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/20 px-3 py-2 text-hud text-xs text-cyan hover:bg-cyan/30 transition">
              <Plus className="h-3.5 w-3.5" /> Add Lender
            </button>
          </div>
        </div>

        {loading ? (
          <div className="hud-panel rounded-md p-8 text-center">
            <div className="text-hud text-cyan mb-2 animate-pulse">LOADING CATALOG…</div>
            <p className="text-xs text-mono text-muted-foreground">// querying lender database</p>
          </div>
        ) : loadError ? (
          <div className="hud-panel rounded-md p-8 text-center border-destructive">
            <div className="text-hud text-destructive mb-2">CATALOG LOAD FAILED</div>
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
        ) : lenders.length === 0 ? (
          <div className="hud-panel rounded-md p-8 text-center">
            <div className="text-hud text-cyan mb-2">CATALOG EMPTY</div>
            <p className="text-sm text-muted-foreground">No lenders found. Use "Paste Guidelines" or "Add Lender" to get started.</p>
          </div>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lenders.map((l) => {
            const count = productsByLender[l.id]?.length ?? 0;
            return (
              <div key={l.id} className="hud-panel rounded-md p-4 group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-hud text-[10px] text-muted-foreground">LENDER</div>
                    <div className="text-base font-semibold text-foreground">{l.name}</div>
                    {l.aeName && <div className="text-xs text-muted-foreground mt-0.5">{l.aeName}</div>}
                  </div>
                  <div className="rounded-sm border border-cyan/40 bg-cyan/10 px-2 py-0.5 text-mono text-xs text-cyan">{count}</div>
                </div>
                <div className="mt-3 flex gap-1.5">
                  <button onClick={() => setActiveLender(activeLender === l.id ? null : l.id)} className="flex-1 rounded-sm border border-border px-2 py-1 text-[10px] text-hud text-muted-foreground hover:border-cyan/60 hover:text-cyan transition">
                    {activeLender === l.id ? "Hide" : "View"} Products
                  </button>
                  <button onClick={() => setEditingLender(l)} className="rounded-sm border border-border px-2 py-1 text-muted-foreground hover:border-cyan/60 hover:text-cyan transition"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => deleteLender(l.id)} className="rounded-sm border border-border px-2 py-1 text-muted-foreground hover:border-destructive hover:text-destructive transition"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {activeLender && (
          <div className="hud-panel rounded-md p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <div className="text-hud text-cyan">Products — {lenders.find((l) => l.id === activeLender)?.name}</div>
              <button onClick={() => newProduct(activeLender)} className="flex items-center gap-1.5 rounded-sm border border-cyan bg-cyan/20 px-3 py-1 text-hud text-xs text-cyan hover:bg-cyan/30">
                <Plus className="h-3 w-3" /> Add Product
              </button>
            </div>
            <div className="space-y-2">
              {(productsByLender[activeLender] ?? []).map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 rounded-sm border border-border bg-background/40 p-3 cursor-pointer hover:border-cyan/40 transition" onClick={() => setDetailProduct(p)}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{p.productName}</div>
                    <div className="text-[10px] text-mono text-muted-foreground mt-0.5">
                      FICO {p.minFico} · LTV {p.maxLtv}% · DTI {p.maxDti}% · {p.loanTypes.join(", ")}
                      {p.dpaAvailable && <> · <span className="text-success">DPA</span></>}
                    </div>
                    {p.notes && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{p.notes}</p>}
                    {p.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.tags.map((t) => <span key={t} className="rounded-sm bg-blue-accent/20 border border-blue-accent/40 px-1.5 py-0.5 text-[10px] text-mono">{t}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); setEditingProduct(p); }} className="rounded-sm border border-border p-1 text-muted-foreground hover:border-cyan/60 hover:text-cyan"><Pencil className="h-3 w-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }} className="rounded-sm border border-border p-1 text-muted-foreground hover:border-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {(productsByLender[activeLender] ?? []).length === 0 && (
                <div className="text-xs text-mono text-muted-foreground text-center py-4">&gt; no products yet</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Product Detail Sheet */}
      <Sheet open={!!detailProduct} onOpenChange={(v) => !v && setDetailProduct(null)}>
        <SheetContent className="bg-panel border-l border-cyan/30 w-full sm:max-w-xl overflow-y-auto">
          {detailProduct && (
            <>
              <SheetHeader>
                <SheetTitle className="text-hud text-cyan glow-cyan">
                  {lenderById[detailProduct.lenderId]?.name} — {detailProduct.productName}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-hud text-[10px] text-muted-foreground mb-3">QUALIFICATION MATRIX</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <QualCell label="MIN FICO" value={String(detailProduct.minFico)} />
                    <QualCell label="MAX LTV" value={`${detailProduct.maxLtv}%`} />
                    <QualCell label="MAX DTI" value={`${detailProduct.maxDti}%`} />
                    <QualCell label="DPA" value={detailProduct.dpaAvailable ? `Yes${detailProduct.dpaMinFico ? ` (≥${detailProduct.dpaMinFico})` : ""}` : "No"} highlight={detailProduct.dpaAvailable} />
                    <QualCell label="GIFT FUNDS" value={detailProduct.giftFundsAllowed ? "Allowed" : "Not Allowed"} highlight={detailProduct.giftFundsAllowed} />
                    <QualCell label="STATES" value={detailProduct.states.includes("ALL") ? "All States" : detailProduct.states.join(", ")} />
                  </div>
                </div>

                <div>
                  <h3 className="text-hud text-[10px] text-muted-foreground mb-2">ELIGIBLE BORROWERS</h3>
                  <div className="space-y-2">
                    <DetailRow label="Loan Types" value={detailProduct.loanTypes.join(", ")} />
                    <DetailRow label="Income Types" value={detailProduct.incomeTypesAllowed.join(", ")} />
                    <DetailRow label="Occupancy" value={detailProduct.occupancies.join(", ")} />
                    <DetailRow label="Property Types" value={detailProduct.propertyTypesAllowed.join(", ")} />
                    <DetailRow label="Special Programs" value={detailProduct.specialPrograms.join(", ") || "—"} />
                  </div>
                </div>

                {detailProduct.notes && (
                  <div>
                    <h3 className="text-hud text-[10px] text-muted-foreground mb-2">PRODUCT NOTES & GUIDELINES</h3>
                    <div className="rounded-sm border border-border bg-background/40 p-3">
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{detailProduct.notes}</p>
                    </div>
                  </div>
                )}

                {detailProduct.tags.length > 0 && (
                  <div>
                    <h3 className="text-hud text-[10px] text-muted-foreground mb-2">TAGS</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detailProduct.tags.map((t) => (
                        <span key={t} className="rounded-sm bg-cyan/10 border border-cyan/40 px-2 py-1 text-[10px] text-mono text-cyan">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Paste-to-Import Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="hud-panel rounded-md p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="text-hud text-cyan">PASTE GUIDELINES</div>
              <button onClick={() => setShowPasteModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Paste lender product matrices, AE emails, guideline PDFs, or any unstructured loan intelligence. Jarvis will extract and add to the catalog.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste guideline text here..."
              className="w-full rounded-sm border border-input bg-background/60 px-3 py-2 text-sm text-mono outline-none focus:border-cyan transition min-h-[300px] resize-y"
              maxLength={50000}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground text-mono">{pasteText.length.toLocaleString()} / 50,000 chars</span>
              <button
                onClick={handlePasteImport}
                disabled={pasteAnalyzing || pasteText.trim().length < 30}
                className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/20 px-4 py-2 text-hud text-xs text-cyan hover:bg-cyan/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {pasteAnalyzing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> ANALYZING...</> : "EXTRACT & IMPORT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLender && <LenderModal lender={editingLender} onSave={saveLender} onCancel={() => setEditingLender(null)} />}
      {editingProduct && <ProductModal product={editingProduct} onSave={saveProduct} onCancel={() => setEditingProduct(null)} />}
      <Toaster theme="dark" />
    </div>
  );
}

function QualCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-sm border border-border bg-background/40 p-2.5">
      <div className="text-hud text-[9px] text-muted-foreground">{label}</div>
      <div className={`text-mono text-sm font-semibold mt-0.5 ${highlight ? "text-success" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-1.5 text-xs">
      <span className="text-hud text-[10px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-mono text-right">{value}</span>
    </div>
  );
}

function Modal({ title, children, onCancel }: { title: string; children: React.ReactNode; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="hud-panel rounded-md p-5 w-full max-w-2xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-hud text-cyan">{title}</div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LenderModal({ lender, onSave, onCancel }: { lender: Lender; onSave: (l: Lender) => void; onCancel: () => void }) {
  const [l, setL] = useState(lender);
  return (
    <Modal title={lender.name ? "Edit Lender" : "New Lender"} onCancel={onCancel}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="Name *"><input value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} className={inputCls} /></FieldLabel>
        <FieldLabel label="AE Name"><input value={l.aeName ?? ""} onChange={(e) => setL({ ...l, aeName: e.target.value })} className={inputCls} /></FieldLabel>
        <FieldLabel label="AE Email"><input value={l.aeEmail ?? ""} onChange={(e) => setL({ ...l, aeEmail: e.target.value })} className={inputCls} /></FieldLabel>
        <FieldLabel label="AE Phone"><input value={l.aePhone ?? ""} onChange={(e) => setL({ ...l, aePhone: e.target.value })} className={inputCls} /></FieldLabel>
        <FieldLabel label="Website"><input value={l.website ?? ""} onChange={(e) => setL({ ...l, website: e.target.value })} className={inputCls} /></FieldLabel>
        <FieldLabel label="States Licensed (comma, or ALL)">
          <input value={l.statesLicensed.join(",")} onChange={(e) => setL({ ...l, statesLicensed: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={inputCls} />
        </FieldLabel>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-sm border border-border px-3 py-1.5 text-xs text-hud text-muted-foreground">Cancel</button>
        <button onClick={() => l.name && onSave(l)} className="rounded-sm border border-cyan bg-cyan/20 px-3 py-1.5 text-xs text-hud text-cyan">Save</button>
      </div>
    </Modal>
  );
}

function ProductModal({ product, onSave, onCancel }: { product: LenderProduct; onSave: (p: LenderProduct) => void; onCancel: () => void }) {
  const [p, setP] = useState(product);
  const toggle = <T extends string>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const Multi = <T extends string>({ label, options, value, set }: { label: string; options: T[]; value: T[]; set: (v: T[]) => void }) => (
    <FieldLabel label={label}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => set(toggle(value, o))} className={`rounded-sm border px-2 py-1 text-[10px] text-hud transition ${value.includes(o) ? "border-cyan bg-cyan/20 text-cyan" : "border-border text-muted-foreground"}`}>{o}</button>
        ))}
      </div>
    </FieldLabel>
  );
  return (
    <Modal title={product.productName ? "Edit Product" : "New Product"} onCancel={onCancel}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="Product Name *"><input value={p.productName} onChange={(e) => setP({ ...p, productName: e.target.value })} className={inputCls} /></FieldLabel>
        <FieldLabel label="Tags (comma)"><input value={p.tags.join(", ")} onChange={(e) => setP({ ...p, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={inputCls} /></FieldLabel>
        <FieldLabel label="Min FICO"><input type="number" value={p.minFico} onChange={(e) => setP({ ...p, minFico: Number(e.target.value) })} className={inputCls} /></FieldLabel>
        <FieldLabel label="Max LTV %"><input type="number" step="0.5" value={p.maxLtv} onChange={(e) => setP({ ...p, maxLtv: Number(e.target.value) })} className={inputCls} /></FieldLabel>
        <FieldLabel label="Max DTI %"><input type="number" step="0.5" value={p.maxDti} onChange={(e) => setP({ ...p, maxDti: Number(e.target.value) })} className={inputCls} /></FieldLabel>
        <FieldLabel label="Notes"><textarea value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} className={inputCls + " min-h-[60px]"} /></FieldLabel>
      </div>
      <div className="mt-3 space-y-3">
        <Multi label="Income Types" options={INCOME_TYPES} value={p.incomeTypesAllowed} set={(v) => setP({ ...p, incomeTypesAllowed: v })} />
        <Multi label="Loan Types" options={LOAN_TYPES} value={p.loanTypes} set={(v) => setP({ ...p, loanTypes: v })} />
        <Multi label="Property Types" options={PROP_TYPES} value={p.propertyTypesAllowed} set={(v) => setP({ ...p, propertyTypesAllowed: v })} />
        <Multi label="Occupancies" options={OCCUPANCIES} value={p.occupancies} set={(v) => setP({ ...p, occupancies: v })} />
        <Multi label="Special Programs" options={SPECIAL} value={p.specialPrograms} set={(v) => setP({ ...p, specialPrograms: v })} />
      </div>
      <div className="mt-3 flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.dpaAvailable} onChange={(e) => setP({ ...p, dpaAvailable: e.target.checked })} className="accent-cyan" /> DPA Available</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.giftFundsAllowed} onChange={(e) => setP({ ...p, giftFundsAllowed: e.target.checked })} className="accent-cyan" /> Gift Funds</label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-sm border border-border px-3 py-1.5 text-xs text-hud text-muted-foreground">Cancel</button>
        <button onClick={() => p.productName && onSave(p)} className="rounded-sm border border-cyan bg-cyan/20 px-3 py-1.5 text-xs text-hud text-cyan">Save</button>
      </div>
    </Modal>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-hud text-[10px] text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
