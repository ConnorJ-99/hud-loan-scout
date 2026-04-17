import { Link, useLocation } from "@tanstack/react-router";
import { Activity, Database, History as HistoryIcon } from "lucide-react";
import { useState } from "react";
import { ScenarioHistoryDrawer } from "./ScenarioHistoryDrawer";

export function HudHeader({ onLoadScenario }: { onLoadScenario?: (id: string) => void }) {
  const loc = useLocation();
  const [historyOpen, setHistoryOpen] = useState(false);

  const navItem = (to: string, label: string, Icon: typeof Activity) => {
    const active = loc.pathname === to;
    return (
      <Link
        to={to}
        className={`group flex items-center gap-2 px-4 py-2 text-hud text-xs transition-all ${
          active
            ? "text-cyan glow-cyan border-b-2 border-cyan"
            : "text-muted-foreground hover:text-cyan border-b-2 border-transparent"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Link>
    );
  };

  return (
    <header className="relative z-10 border-b border-border bg-panel/60 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-sm border border-cyan/60 animate-pulse-glow" />
              <div className="absolute inset-1 rounded-sm bg-cyan/20" />
              <div className="absolute inset-2 rounded-sm bg-cyan animate-data-pulse" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-display text-lg font-bold text-cyan glow-cyan">LOAN<span className="text-foreground">IQ</span></span>
              <span className="text-hud text-[10px] text-muted-foreground">MORTGAGE INTELLIGENCE // v1.0</span>
            </div>
          </Link>
          <nav className="flex items-center">
            {navItem("/", "Matcher", Activity)}
            {navItem("/catalog", "Lender Catalog", Database)}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 rounded-sm border border-border px-3 py-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-success animate-data-pulse" />
            <span className="text-hud text-[10px] text-muted-foreground">JARVIS ONLINE</span>
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-2 rounded-sm border border-border bg-panel/50 px-3 py-1.5 text-hud text-xs text-muted-foreground transition hover:border-cyan/60 hover:text-cyan"
          >
            <HistoryIcon className="h-3.5 w-3.5" />
            History
          </button>
        </div>
      </div>

      <ScenarioHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onLoad={(id) => {
          setHistoryOpen(false);
          onLoadScenario?.(id);
        }}
      />
    </header>
  );
}
