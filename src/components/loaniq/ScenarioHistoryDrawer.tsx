import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { store } from "@/lib/loaniq/storage";
import type { ScenarioHistoryEntry } from "@/lib/loaniq/types";
import { Trash2, Clock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLoad: (id: string) => void;
}

export function ScenarioHistoryDrawer({ open, onOpenChange, onLoad }: Props) {
  const [items, setItems] = useState<ScenarioHistoryEntry[]>([]);

  useEffect(() => {
    if (open) setItems(store.getHistory().sort((a, b) => b.timestamp - a.timestamp));
  }, [open]);

  const remove = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    store.setHistory(next);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-panel border-l border-cyan/30 w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-hud text-cyan glow-cyan">Scenario History</SheetTitle>
          <p className="text-xs text-muted-foreground">Saved searches from this device.</p>
        </SheetHeader>

        <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)] pr-1">
          {items.length === 0 && (
            <div className="text-xs text-muted-foreground text-mono py-12 text-center">
              &gt; no scenarios logged yet
            </div>
          )}
          {items.map((it) => (
            <div
              key={it.id}
              className="hud-panel rounded-sm p-3 cursor-pointer group"
              onClick={() => onLoad(it.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-hud text-sm text-cyan truncate">{it.nickname}</div>
                  <div className="text-[10px] text-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(it.timestamp).toLocaleString()}
                  </div>
                  {it.topProduct && (
                    <div className="text-xs text-muted-foreground mt-1.5 truncate">
                      Top: <span className="text-success">{it.topProduct}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    FICO {it.scenario.creditScore} · LTV {((it.scenario.loanAmount / Math.max(1, it.scenario.propertyValue)) * 100).toFixed(0)}% · {it.scenario.loanPurpose}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(it.id); }}
                  className="text-muted-foreground hover:text-destructive transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
