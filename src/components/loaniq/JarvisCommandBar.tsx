import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Terminal, Mic, MicOff, RotateCcw, User, Bot } from "lucide-react";
import { askJarvis } from "@/lib/loaniq/ai";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import type { ChatMessage, Lender, LenderProduct } from "@/lib/loaniq/types";
import { ScrollArea } from "@/components/ui/scroll-area";

const SAMPLE_QUERIES = [
  "Who has down payment assistance down to 580 credit?",
  "Find me a DSCR loan for a 3-unit property at 75% LTV",
  "Which lenders allow gift funds with FHA under 620?",
];

interface Props {
  lenders: Lender[];
  products: LenderProduct[];
  onMatchedProducts?: (productIds: string[]) => void;
}

export function JarvisCommandBar({ lenders, products, onMatchedProducts }: Props) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<{ start: () => void; stop: () => void; abort: () => void } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const listeningRef = useRef(false); // track listening state for onend restart

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Keep listeningRef in sync
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognitionCtor = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new (SpeechRecognitionCtor as new () => {
      continuous: boolean; interimResults: boolean; lang: string;
      onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void; stop: () => void; abort: () => void;
    })();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        setQuery((prev) => (prev + " " + final).trim());
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setListening(false);
        listeningRef.current = false;
        stopAudioMonitor();
      }
    };

    // AUTO-RESTART: Browser may stop recognition after silence.
    // If we're still in "listening" mode, restart it automatically.
    recognition.onend = () => {
      if (listeningRef.current) {
        // Browser stopped due to silence — restart
        try {
          recognition.start();
        } catch {
          // Already started or other error — ignore
        }
      } else {
        setInterimText("");
        stopAudioMonitor();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      stopAudioMonitor();
    };
  }, []);

  const startAudioMonitor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        setAudioLevel(Math.min(100, (avg / 128) * 100));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Mic access denied — voice still works, just no level viz
    }
  }, []);

  const stopAudioMonitor = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();
    mediaStreamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const toggleMic = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }
    if (listening) {
      listeningRef.current = false;
      setListening(false);
      recognitionRef.current.stop();
      setInterimText("");
      stopAudioMonitor();
    } else {
      setInterimText("");
      listeningRef.current = true;
      setListening(true);
      recognitionRef.current.start();
      startAudioMonitor();
    }
  }, [listening, startAudioMonitor, stopAudioMonitor]);

  const submit = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text || loading) return;

    // Stop mic if listening
    if (listening && recognitionRef.current) {
      listeningRef.current = false;
      setListening(false);
      recognitionRef.current.stop();
      setInterimText("");
      stopAudioMonitor();
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setQuery("");
    setLoading(true);

    try {
      const result = await askJarvis(newMessages, { lenders, products });
      const assistantMsg: ChatMessage = { role: "assistant", content: result.content };
      setMessages([...newMessages, assistantMsg]);

      // Surface matched products to parent for card display
      if (result.matchedProductIds.length > 0 && onMatchedProducts) {
        onMatchedProducts(result.matchedProductIds);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI request failed";
      toast.error(msg);
      const errorMsg: ChatMessage = { role: "assistant", content: `> ERROR: ${msg}` };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const newConversation = () => {
    setMessages([]);
    setQuery("");
    setInterimText("");
    onMatchedProducts?.([]);
  };

  const displayedQuery = interimText ? (query + " " + interimText).trim() : query;

  return (
    <section className="relative">
      <div className="hud-panel rounded-md p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-cyan" />
            <span className="text-hud text-xs text-cyan">JARVIS COMMAND BAR</span>
            <span className="text-hud text-[10px] text-muted-foreground">// {lenders.length} lenders · {products.length} products</span>
          </div>
          {messages.length > 0 && (
            <button onClick={newConversation} className="flex items-center gap-1 text-[10px] text-hud text-muted-foreground hover:text-cyan transition rounded-sm border border-border px-2 py-1">
              <RotateCcw className="h-3 w-3" /> NEW CHAT
            </button>
          )}
        </div>

        {/* Chat history */}
        {messages.length > 0 && (
          <ScrollArea className="max-h-[400px] mb-3">
            <div className="space-y-3 pr-2">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-6 w-6 rounded-full bg-cyan/20 border border-cyan/40 flex items-center justify-center">
                        <Bot className="h-3.5 w-3.5 text-cyan" />
                      </div>
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-md p-3 text-sm ${
                    msg.role === "user"
                      ? "bg-cyan/10 border border-cyan/30 text-foreground"
                      : "bg-background/70 border border-border text-foreground"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="text-mono">{msg.content}</span>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-6 w-6 rounded-full bg-panel border border-border flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-6 w-6 rounded-full bg-cyan/20 border border-cyan/40 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-cyan" />
                    </div>
                  </div>
                  <div className="bg-background/70 border border-border rounded-md p-3">
                    <div className="text-mono text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      analyzing catalog
                      <span className="terminal-cursor" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
        )}

        {/* Input bar */}
        <div className="flex items-center gap-2 rounded-sm border border-cyan/40 bg-background/60 px-3 py-2.5 focus-within:border-cyan focus-within:shadow-[0_0_24px_oklch(0.82_0.16_220/0.3)] transition">
          <span className="text-mono text-cyan">&gt;</span>
          <input
            value={displayedQuery}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={messages.length > 0 ? "Continue the conversation..." : "Ask anything... 'Who has DPA down to 580 FICO?'"}
            className={`flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none text-mono ${
              !displayedQuery && !loading ? "terminal-cursor" : ""
            }`}
          />

          {/* Audio level indicator */}
          {listening && (
            <div className="flex items-center gap-0.5 h-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-cyan transition-all duration-75"
                  style={{
                    height: `${Math.max(4, (audioLevel / 100) * 20 * (1 + Math.sin(Date.now() / 100 + i)))}px`,
                    opacity: audioLevel > i * 15 ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
          )}

          <button
            onClick={toggleMic}
            className={`flex items-center justify-center rounded-sm p-1.5 transition ${
              listening
                ? "bg-destructive/20 text-destructive border border-destructive/50 animate-pulse"
                : "text-muted-foreground hover:text-cyan"
            }`}
            title={listening ? "Stop listening" : "Voice input"}
          >
            {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => submit()}
            disabled={loading || !displayedQuery.trim()}
            className="flex items-center gap-1.5 rounded-sm bg-cyan/20 px-3 py-1 text-hud text-xs text-cyan border border-cyan/50 hover:bg-cyan/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            SEND
          </button>
        </div>

        {/* Sample queries — only show if no conversation yet */}
        {messages.length === 0 && (
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
        )}
      </div>
    </section>
  );
}
