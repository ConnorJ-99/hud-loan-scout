import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { HudHeader } from "@/components/loaniq/HudHeader";
import { ensureSeeded, store } from "@/lib/loaniq/storage";
import { loadCatalogFromDb } from "@/lib/loaniq/dbCatalog";
import type { Lender, LenderProduct, IncomeType, LoanType, PropertyType, Occupancy, SpecialNeed } from "@/lib/loaniq/types";
import { Plus, Pencil, Trash2, X, Upload } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Lender & Product Catalog — LoanIQ" },
      { name: "description", content: "Manage your lender and product database — the source of truth that LoanIQ scans." },
      { property: "og:title", content: "Lender & Product Catalog — LoanIQ" },
      { property: "og:description", content: "Add lenders, define product guidelines, import via CSV." },
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

  useEffect(() => {
    ensureSeeded();
    setLenders(store.getLenders());
    setProducts(store.getProducts());
  }, []);

  const productsByLender = useMemo(() => {
    const m: Record<string, LenderProduct[]> = {};
    for (const p of products) (m[p.lenderId] ||= []).push(p);
    return m;
  }, [products]);

  const saveLender = (l: Lender) => {
    const exists = lenders.find((x) => x.id === l.id);
    const next = exists ? lenders.map((x) => (x.id === l.id ? l : x)) : [...lenders, l];
    setLenders(next); store.setLenders(next);
    setEditingLender(null);
    toast.success(exists ? "Lender updated" : "Lender added");
  };

  const deleteLender = (id: string) => {
    if (!confirm("Delete lender and all its products?")) return;
    const nextLenders = lenders.filter((l) => l.id !== id);
    const nextProducts = products.filter((p) => p.lenderId !== id);
    setLenders(nextLenders); setProducts(nextProducts);
    store.setLenders(nextLenders); store.setProducts(nextProducts);
    if (activeLender === id) setActiveLender(null);
  };

  const saveProduct = (p: LenderProduct) => {
    const exists = products.find((x) => x.id === p.id);
    const next = exists ? products.map((x) => (x.id === p.id ? p : x)) : [...products, p];
    setProducts(next); store.setProducts(next);
    setEditingProduct(null);
    toast.success(exists ? "Product updated" : "Product added");
  };

  const deleteProduct = (id: string) => {
    if (!confirm("Delete product?")) return;
    const next = products.filter((p) => p.id !== id);
    setProducts(next); store.setProducts(next);
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
    setProducts(next); store.setProducts(next);
    e.target.value = "";
    toast.success(`Imported ${added} products`);
  };

  return (
    <div className="min-h-screen">
      <HudHeader />
      <main className="relative z-10 mx-auto max-w-[1800px] px-6 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display text-2xl text-cyan glow-cyan">LENDER CATALOG</h1>
            <p className="text-xs text-mono text-muted-foreground">// {lenders.length} lenders · {products.length} products in database</p>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer flex items-center gap-2 rounded-sm border border-border bg-panel/60 px-3 py-2 text-hud text-xs text-muted-foreground hover:border-cyan/60 hover:text-cyan transition">
              <Upload className="h-3.5 w-3.5" /> Import CSV
              <input type="file" accept=".csv" onChange={handleCsv} className="hidden" />
            </label>
            <button onClick={newLender} className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/20 px-3 py-2 text-hud text-xs text-cyan hover:bg-cyan/30 transition">
              <Plus className="h-3.5 w-3.5" /> Add Lender
            </button>
          </div>
        </div>

        <div className="text-[10px] text-mono text-muted-foreground bg-panel/40 border border-border rounded-sm p-2">
          CSV columns: <span className="text-cyan">lenderId,productName,minFico,maxLtv,maxDti,incomeTypes,propertyTypes,loanTypes,dpaAvailable,dpaMinFico,giftFunds,occupancies,states,specialPrograms,notes,tags</span> &nbsp;(use | to separate multi-values)
        </div>

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
                    {l.aeEmail && <div className="text-[10px] text-mono text-muted-foreground">{l.aeEmail}</div>}
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
                <div key={p.id} className="flex items-start justify-between gap-3 rounded-sm border border-border bg-background/40 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{p.productName}</div>
                    <div className="text-[10px] text-mono text-muted-foreground mt-0.5">
                      FICO {p.minFico} · LTV {p.maxLtv}% · DTI {p.maxDti}% · {p.loanTypes.join(", ")}
                      {p.dpaAvailable && <> · <span className="text-success">DPA</span></>}
                    </div>
                    {p.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.tags.map((t) => <span key={t} className="rounded-sm bg-blue-accent/20 border border-blue-accent/40 px-1.5 py-0.5 text-[10px] text-mono">{t}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setEditingProduct(p)} className="rounded-sm border border-border p-1 text-muted-foreground hover:border-cyan/60 hover:text-cyan"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => deleteProduct(p.id)} className="rounded-sm border border-border p-1 text-muted-foreground hover:border-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
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

      {editingLender && <LenderModal lender={editingLender} onSave={saveLender} onCancel={() => setEditingLender(null)} />}
      {editingProduct && <ProductModal product={editingProduct} onSave={saveProduct} onCancel={() => setEditingProduct(null)} />}
      <Toaster theme="dark" />
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
        <Field label="Name *"><input value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} className={inputCls} /></Field>
        <Field label="AE Name"><input value={l.aeName ?? ""} onChange={(e) => setL({ ...l, aeName: e.target.value })} className={inputCls} /></Field>
        <Field label="AE Email"><input value={l.aeEmail ?? ""} onChange={(e) => setL({ ...l, aeEmail: e.target.value })} className={inputCls} /></Field>
        <Field label="AE Phone"><input value={l.aePhone ?? ""} onChange={(e) => setL({ ...l, aePhone: e.target.value })} className={inputCls} /></Field>
        <Field label="Website"><input value={l.website ?? ""} onChange={(e) => setL({ ...l, website: e.target.value })} className={inputCls} /></Field>
        <Field label="States Licensed (comma, or ALL)">
          <input value={l.statesLicensed.join(",")} onChange={(e) => setL({ ...l, statesLicensed: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={inputCls} />
        </Field>
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
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => set(toggle(value, o))} className={`rounded-sm border px-2 py-1 text-[10px] text-hud transition ${value.includes(o) ? "border-cyan bg-cyan/20 text-cyan" : "border-border text-muted-foreground"}`}>{o}</button>
        ))}
      </div>
    </Field>
  );
  return (
    <Modal title={product.productName ? "Edit Product" : "New Product"} onCancel={onCancel}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Product Name *"><input value={p.productName} onChange={(e) => setP({ ...p, productName: e.target.value })} className={inputCls} /></Field>
        <Field label="Tags (comma)"><input value={p.tags.join(", ")} onChange={(e) => setP({ ...p, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={inputCls} /></Field>
        <Field label="Min FICO"><input type="number" value={p.minFico} onChange={(e) => setP({ ...p, minFico: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="Max LTV %"><input type="number" step="0.5" value={p.maxLtv} onChange={(e) => setP({ ...p, maxLtv: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="Max DTI %"><input type="number" step="0.5" value={p.maxDti} onChange={(e) => setP({ ...p, maxDti: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="States (comma or ALL)"><input value={p.states.join(",")} onChange={(e) => setP({ ...p, states: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={inputCls} /></Field>
      </div>
      <div className="mt-3 grid gap-3">
        <Multi label="Loan Types" options={LOAN_TYPES} value={p.loanTypes} set={(v) => setP({ ...p, loanTypes: v })} />
        <Multi label="Income Types Allowed" options={INCOME_TYPES} value={p.incomeTypesAllowed} set={(v) => setP({ ...p, incomeTypesAllowed: v })} />
        <Multi label="Property Types" options={PROP_TYPES} value={p.propertyTypesAllowed} set={(v) => setP({ ...p, propertyTypesAllowed: v })} />
        <Multi label="Occupancies" options={OCCUPANCIES} value={p.occupancies} set={(v) => setP({ ...p, occupancies: v })} />
        <Multi label="Special Programs" options={SPECIAL} value={p.specialPrograms} set={(v) => setP({ ...p, specialPrograms: v })} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.dpaAvailable} onChange={(e) => setP({ ...p, dpaAvailable: e.target.checked })} className="accent-cyan" /> DPA Available</label>
        <Field label="DPA Min FICO"><input type="number" disabled={!p.dpaAvailable} value={p.dpaMinFico ?? ""} onChange={(e) => setP({ ...p, dpaMinFico: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} /></Field>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.giftFundsAllowed} onChange={(e) => setP({ ...p, giftFundsAllowed: e.target.checked })} className="accent-cyan" /> Gift Funds Allowed</label>
      </div>
      <div className="mt-3">
        <Field label="Notes"><textarea rows={3} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} className={`${inputCls} resize-y`} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-sm border border-border px-3 py-1.5 text-xs text-hud text-muted-foreground">Cancel</button>
        <button onClick={() => p.productName && onSave(p)} className="rounded-sm border border-cyan bg-cyan/20 px-3 py-1.5 text-xs text-hud text-cyan">Save</button>
      </div>
    </Modal>
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
