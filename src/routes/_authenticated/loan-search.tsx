import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { JarvisCommandBar } from "@/components/loaniq/JarvisCommandBar";
import { ScenarioForm } from "@/components/loaniq/ScenarioForm";
import { ResultsPanel } from "@/components/loaniq/ResultsPanel";
import type { BorrowerScenario, Lender, LenderProduct, MatchResult, ScenarioHistoryEntry } from "@/lib/loaniq/types";
import { store } from "@/lib/loaniq/storage";
import { rankMatches } from "@/lib/loaniq/match";
import { analyzeScenario } from "@/lib/loaniq/ai";
import { loadCatalogFromDb } from "@/lib/loaniq/dbCatalog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/loan-search")({
  head: () => ({
    meta: [
      { title: "Loan Search — LoanIQ" },
      { name: "description", content: "Match borrower scenarios to lender products and guidelines." },
    ],
  }),
  component: LoanSearch,
});

function LoanSearch() {
  const { user } = useAuth();
  const [initialScenario, setInitialScenario] = useState<BorrowerScenario | undefined>(undefined);
  const [scenario, setScenario] = useState<BorrowerScenario | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [catalogLenders, setCatalogLenders] = useState<Lender[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<LenderProduct[]>([]);
  const [jarvisSource, setJarvisSource] = useState(false);

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
    await new Promise((r) => setTimeout(r, 500));

    const { lenders, products } = await loadCatalogFromDb();
    setCatalogLenders(lenders);
    setCatalogProducts(products);

    const ranked = rankMatches(s, products);
    setMatches(ranked);
    setScanning(false);

    const top = ranked[0];
    const topProduct = top ? products.find((p) => p.id === top.productId) : undefined;
    const topLender = topProduct ? lenders.find((l) => l.id === topProduct.lenderId) : undefined;

    // Local history
    const entry: ScenarioHistoryEntry = {
      id: `hist_${Date.now()}`,
      timestamp: Date.now(),
      nickname: s.nickname?.trim() || `Scenario ${new Date().toLocaleDateString()}`,
      scenario: s,
      topLender: topLender?.name,
      topProduct: topProduct?.productName,
    };
    store.setHistory([entry, ...store.getHistory()].slice(0, 50));

    // Persist to DB so it shows in dashboard / reports
    if (user) {
      supabase.from("loan_searches").insert({
        created_by: user.id,
        nickname: entry.nickname,
        scenario: s as unknown as Record<string, unknown>,
        top_lender: topLender?.name ?? null,
        top_product: topProduct?.productName ?? null,
        match_count: ranked.length,
      }).then(({ error }) => {
        if (error) console.warn("Failed to save loan search:", error);
      });
    }

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

  const handleJarvisMatchedProducts = useCallback((productIds: string[]) => {
    if (productIds.length === 0) {
      if (jarvisSource) {
        setMatches([]);
        setJarvisSource(false);
      }
      return;
    }
    const results: MatchResult[] = [];
    productIds.forEach((id, idx) => {
      const product = catalogProducts.find((p) => p.id === id);
      if (!product) return;
      results.push({
        productId: id,
        matchScore: 100 - idx * 5,
        status: (idx === 0 ? "STRONG MATCH" : idx < 3 ? "POSSIBLE MATCH" : "CONDITIONAL MATCH") as MatchResult["status"],
        highlights: [`Recommended by Jarvis`, `Min FICO ${product.minFico}`, `Max LTV ${product.maxLtv}%`],
        caveats: [] as string[],
      });
    });
    setMatches(results);
    setScenario(null);
    setJarvisSource(true);
    setAiAnalysis("");
    setAiLoading(false);
  }, [catalogProducts, jarvisSource]);

  return (
    <div>
      <PageHeader title="Loan Search" subtitle="Borrower scenario → matched lender products" />
      <div className="px-6 py-6 space-y-5 max-w-[1800px]">
        <JarvisCommandBar
          lenders={catalogLenders}
          products={catalogProducts}
          onMatchedProducts={handleJarvisMatchedProducts}
        />
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5">
          <aside className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto pb-2">
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
      </div>
    </div>
  );
}
