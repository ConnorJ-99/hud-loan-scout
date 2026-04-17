import { useState } from "react";
import { Send, Loader2, Terminal } from "lucide-react";
import { askJarvis } from "@/lib/loaniq/ai";
import { store } from "@/lib/loaniq/storage";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const SAMPLE_QUERIES = [
  "Who has down payment assistance down to 580 credit?",
  "Find me a DSCR loan for a 3-unit property at 75% LTV",
  "Which lenders allow gift funds with FHA under 620?",
];

export function JarvisCommandBar() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const submit = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text || loading) return;
    setLoading(true);
    setResponse("");
    try {
      const lenders = store.getLenders();
      const products = store.getProducts();
      const out = await askJarvis(text, { lenders, products });
      setResponse(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI request failed";
      toast.error(msg);
      setResponse(`> ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative">
      <div className="hud-panel rounded-md p-5">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="h-4 w-4 text-cyan" />
          <span className="text-hud text-xs text-cyan">JARVIS COMMAND BAR</span>
          <span className="text-hud text-[10px] text-muted-foreground">// natural language query</span>
        </div>

        <div className="flex items-center gap-2 rounded-sm border border-cyan/40 bg-background/60 px-3 py-2.5 focus-within:border-cyan focus-within:shadow-[0_0_24px_oklch(0.82_0.16_220/0.3)] transition">
          <span className="text-mono text-cyan">&gt;</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Ask anything... 'Who has DPA down to 580 FICO?'"
            className={`flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none text-mono ${
              !query && !loading ? "terminal-cursor" : ""
            }`}
          />
          <button
            onClick={() => submit()}
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 rounded-sm bg-cyan/20 px-3 py-1 text-hud text-xs text-cyan border border-cyan/50 hover:bg-cyan/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            EXECUTE
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {SAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => { setQuery(q); submit(q); }}
              disabled={loading}
              className="rounded-sm border border-border bg-panel/40 px-2.5 py-1 text-[10px] text-mono text-muted-foreground hover:border-cyan/60 hover:text-cyan transition disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>

        {(loading || response) && (
          <div className="mt-4 rounded-sm border border-cyan/30 bg-background/70 p-4 scanline animate-slide-up">
            <div className="flex items-center gap-2 mb-2 text-hud text-[10px] text-cyan">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan animate-data-pulse" />
              JARVIS RESPONSE
            </div>
            {loading && !response ? (
              <div className="text-mono text-xs text-muted-foreground">
                <span>analyzing catalog</span>
                <span className="terminal-cursor" />
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none text-sm">
                <ReactMarkdown>{response}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
