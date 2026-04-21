import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
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

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "LoanIQ — Mortgage Product Matching Intelligence" },
      { name: "description", content: "AI-powered mortgage product matching for brokers." },
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
  const [jarvisSource, setJarvisSource] = useState(false); // true when results come from Jarvis chat

  useEffect(() => {
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
    setJarvisSource(false);
    await new Promise((r) => setTimeout(r, 700));

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

  const handleReset = () => {
    setScenario(null);
    setMatches([]);
    setAiAnalysis("");
    setAiLoading(false);
    setInitialScenario(undefined);
    setJarvisSource(false);
  };

  const loadHistoric = (id: string) => {
    const item = store.getHistory().find((h) => h.id === id);
    if (item) {
      setInitialScenario(item.scenario);
      toast.success(`Loaded "${item.nickname}"`);
    }
  };

  // When Jarvis chat recommends products, show them in the results panel
  const handleJarvisMatchedProducts = useCallback((productIds: string[]) => {
    if (productIds.length === 0) {
      // Clear Jarvis results
      if (jarvisSource) {
        setMatches([]);
        setJarvisSource(false);
      }
      return;
    }

    // Build match results from the product IDs
    const results: MatchResult[] = productIds
      .map((id, idx) => {
        const product = catalogProducts.find((p) => p.id === id);
        if (!product) return null;
        return {
          productId: id,
          matchScore: 100 - idx * 5, // rank by order AI returned them
          status: (idx === 0 ? "STRONG MATCH" : idx < 3 ? "POSSIBLE MATCH" : "CONDITIONAL MATCH") as MatchResult["status"],
          highlights: [`Recommended by Jarvis`, `Min FICO ${product.minFico}`, `Max LTV ${product.maxLtv}%`],
          caveats: [],
        };
      })
      .filter((m): m is MatchResult => m !== null);

    setMatches(results);
    setScenario(null); // clear scenario — these are Jarvis-sourced
    setJarvisSource(true);
    setAiAnalysis("");
    setAiLoading(false);
  }, [catalogProducts, jarvisSource]);

  return (
    <div className="min-h-screen relative">
      <HudHeader onLoadScenario={loadHistoric} />
      <main className="relative z-10 mx-auto max-w-[1800px] px-6 py-6 space-y-5">
        <JarvisCommandBar
          lenders={catalogLenders}
          products={catalogProducts}
          onMatchedProducts={handleJarvisMatchedProducts}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5">
          <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto pb-2">
            <ScenarioForm initial={initialScenario} onScan={handleScan} onReset={handleReset} scanning={scanning} />
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
