import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HudHeader } from "@/components/loaniq/HudHeader";
import { JarvisCommandBar } from "@/components/loaniq/JarvisCommandBar";
import { ScenarioForm } from "@/components/loaniq/ScenarioForm";
import { ResultsPanel } from "@/components/loaniq/ResultsPanel";
import type { BorrowerScenario, Lender, LenderProduct, MatchResult, ScenarioHistoryEntry } from "@/lib/loaniq/types";
import { store } from "@/lib/loaniq/storage";
import { rankMatches } from "@/lib/loaniq/match";
import { analyzeScenario } from "@/lib/loaniq/ai";
import { loadCatalogFromDb } from "@/lib/loaniq/dbCatalog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoanIQ — Mortgage Product Matching Intelligence" },
      { name: "description", content: "AI-powered mortgage product matching for brokers. Scan lender catalogs, surface every qualifying loan program, ranked by fit." },
      { property: "og:title", content: "LoanIQ — Mortgage Product Matching Intelligence" },
      { property: "og:description", content: "Jarvis-grade mortgage matcher: scan lender catalogs, find every loan a borrower qualifies for." },
    ],
  }),
  component: Index,
});

function Index() {
  const [initialScenario, setInitialScenario] = useState<BorrowerScenario | undefined>(undefined);
  const [scenario, setScenario] = useState<BorrowerScenario | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [catalogLenders, setCatalogLenders] = useState<Lender[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<LenderProduct[]>([]);

  useEffect(() => {
    // One-time cleanup: purge stale demo seed data from localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("loaniq.lenders.v1");
        localStorage.removeItem("loaniq.products.v1");
      } catch {}
    }
    loadCatalogFromDb().then(({ lenders, products }) => {
      setCatalogLenders(lenders);
      setCatalogProducts(products);
    });
  }, []);

  const handleScan = async (s: BorrowerScenario) => {
    setScanning(true);
    setScenario(s);
    setMatches([]);
    setAiAnalysis("");
    await new Promise((r) => setTimeout(r, 700));

    // Always pull fresh catalog so newly committed knowledge feeds the match
    const { lenders, products } = await loadCatalogFromDb();
    setCatalogLenders(lenders);
    setCatalogProducts(products);

    const ranked = rankMatches(s, products);
    setMatches(ranked);
    setScanning(false);

    const top = ranked[0];
    const topProduct = top ? products.find((p) => p.id === top.productId) : undefined;
    const topLender = topProduct ? lenders.find((l) => l.id === topProduct.lenderId) : undefined;
    const entry: ScenarioHistoryEntry = {
      id: `hist_${Date.now()}`,
      timestamp: Date.now(),
      nickname: s.nickname?.trim() || `Scenario ${new Date().toLocaleDateString()}`,
      scenario: s,
      topLender: topLender?.name,
      topProduct: topProduct?.productName,
    };
    store.setHistory([entry, ...store.getHistory()].slice(0, 50));

    setAiLoading(true);
    try {
      const out = await analyzeScenario(s, { lenders, products });
      setAiAnalysis(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI analysis failed";
      toast.error(msg);
      setAiAnalysis(`> AI ERROR: ${msg}`);
    } finally {
      setAiLoading(false);
    }
  };

  const loadHistoric = (id: string) => {
    const item = store.getHistory().find((h) => h.id === id);
    if (item) {
      setInitialScenario(item.scenario);
      toast.success(`Loaded "${item.nickname}"`);
    }
  };

  return (
    <div className="min-h-screen relative">
      <HudHeader onLoadScenario={loadHistoric} />
      <main className="relative z-10 mx-auto max-w-[1800px] px-6 py-6 space-y-5">
        <JarvisCommandBar />

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5">
          <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto pb-2">
            <ScenarioForm initial={initialScenario} onScan={handleScan} scanning={scanning} />
          </aside>
          <section>
            <ResultsPanel
              scenario={scenario}
              matches={matches}
              lenders={catalogLenders}
              products={catalogProducts}
              scanning={scanning}
              aiAnalysis={aiAnalysis}
              aiLoading={aiLoading}
            />
          </section>
        </div>
      </main>
      <Toaster theme="dark" />
    </div>
  );
}
