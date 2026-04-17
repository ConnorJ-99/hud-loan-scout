import type { Lender, LenderProduct, ScenarioHistoryEntry } from "./types";
import { seedLenders, seedProducts } from "./seed";

const KEYS = {
  lenders: "loaniq.lenders.v1",
  products: "loaniq.products.v1",
  history: "loaniq.history.v1",
  shortlist: "loaniq.shortlist.v1",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function ensureSeeded() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(KEYS.lenders)) write(KEYS.lenders, seedLenders);
  if (!localStorage.getItem(KEYS.products)) write(KEYS.products, seedProducts);
}

export const store = {
  getLenders(): Lender[] { return read<Lender[]>(KEYS.lenders, []); },
  setLenders(v: Lender[]) { write(KEYS.lenders, v); },
  getProducts(): LenderProduct[] { return read<LenderProduct[]>(KEYS.products, []); },
  setProducts(v: LenderProduct[]) { write(KEYS.products, v); },
  getHistory(): ScenarioHistoryEntry[] { return read<ScenarioHistoryEntry[]>(KEYS.history, []); },
  setHistory(v: ScenarioHistoryEntry[]) { write(KEYS.history, v); },
  getShortlist(): string[] { return read<string[]>(KEYS.shortlist, []); },
  setShortlist(v: string[]) { write(KEYS.shortlist, v); },
};
