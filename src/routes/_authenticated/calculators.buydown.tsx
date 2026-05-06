import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Download, Sparkles, TrendingDown, Calculator as CalcIcon } from "lucide-react";
import {
  type BuydownInputs,
  type BuydownType,
  DEFAULT_INPUTS,
  calcBuydown,
  fmtUSD,
  fmtUSD2,
  fmtPct,
  DISCLAIMER,
} from "@/lib/loaniq/buydown";
import { generateBuydownPDF } from "@/lib/loaniq/buydownPdf";

export const Route = createFileRoute("/_authenticated/calculators/buydown")({
  head: () => ({
    meta: [
      { title: "Buydown Calculator — LoanIQ" },
      {
        name: "description",
        content:
          "Compare standard mortgage payments against 1-0, 2-1, 3-2-1, and custom temporary buydowns. Generate a borrower-ready PDF.",
      },
    ],
  }),
  component: BuydownCalculator,
});

function NumField({
  label,
  value,
  onChange,
  step = "1",
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-hud text-[10px] text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`bg-panel/40 ${prefix ? "pl-7" : ""} ${suffix ? "pr-9" : ""}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function BuydownCalculator() {
  const [inp, setInp] = useState<BuydownInputs>(DEFAULT_INPUTS);
  const set = <K extends keyof BuydownInputs>(k: K, v: BuydownInputs[K]) =>
    setInp((p) => ({ ...p, [k]: v }));

  const res = useMemo(() => calcBuydown(inp), [inp]);

  function downloadPDF() {
    const doc = generateBuydownPDF(inp, res);
    doc.save(`Buydown-Guide-${inp.loanAmount}-${inp.buydownType}.pdf`);
  }

  function updateCustom(idx: number, val: number) {
    const next = [...inp.customReductions];
    next[idx] = val;
    set("customReductions", next);
  }

  function addCustomYear() {
    set("customReductions", [...inp.customReductions, 1]);
  }

  function removeCustomYear(idx: number) {
    set(
      "customReductions",
      inp.customReductions.filter((_, i) => i !== idx),
    );
  }

  return (
    <>
      <PageHeader
        title="BUYDOWN CALCULATOR"
        subtitle="compare standard vs temporary buydown · generate borrower PDF"
        actions={
          <Button onClick={downloadPDF} className="gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        }
      />

      <div className="px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* INPUTS */}
          <Card className="lg:col-span-1 border-border bg-panel/40">
            <CardHeader>
              <CardTitle className="text-display text-cyan flex items-center gap-2">
                <CalcIcon className="h-4 w-4" /> Loan Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NumField
                label="Loan Amount"
                value={inp.loanAmount}
                onChange={(n) => set("loanAmount", n)}
                prefix="$"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-hud text-[10px] text-muted-foreground">Term (yrs)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={40}
                    value={inp.termYears}
                    onChange={(e) =>
                      set("termYears", Math.min(40, Math.max(5, parseInt(e.target.value) || 30)))
                    }
                    className="bg-panel/40"
                  />
                </div>
                <NumField
                  label="Base Rate"
                  value={inp.baseRatePct}
                  onChange={(n) => set("baseRatePct", n)}
                  step="0.001"
                  suffix="%"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-hud text-[10px] text-muted-foreground">First Payment</Label>
                <Input
                  type="date"
                  value={inp.firstPaymentDate}
                  onChange={(e) => set("firstPaymentDate", e.target.value)}
                  className="bg-panel/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-hud text-[10px] text-muted-foreground">Transaction</Label>
                <Select
                  value={inp.transactionType}
                  onValueChange={(v) => set("transactionType", v as BuydownInputs["transactionType"])}
                >
                  <SelectTrigger className="bg-panel/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Purchase">Purchase</SelectItem>
                    <SelectItem value="Refinance">Refinance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-hud text-[10px] text-muted-foreground">Buydown Type</Label>
                <Select
                  value={inp.buydownType}
                  onValueChange={(v) => set("buydownType", v as BuydownType)}
                >
                  <SelectTrigger className="bg-panel/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-0">1-0 Buydown</SelectItem>
                    <SelectItem value="2-1">2-1 Buydown</SelectItem>
                    <SelectItem value="3-2-1">3-2-1 Buydown</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inp.buydownType === "custom" && (
                <div className="space-y-2 rounded-md border border-border bg-panel/30 p-3">
                  <div className="text-hud text-[10px] text-muted-foreground">
                    Rate reductions (% per year)
                  </div>
                  {inp.customReductions.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14">Year {i + 1}</span>
                      <Input
                        type="number"
                        step="0.125"
                        value={r}
                        onChange={(e) => updateCustom(i, parseFloat(e.target.value) || 0)}
                        className="bg-panel/40 h-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomYear(i)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addCustomYear}>
                    + Add year
                  </Button>
                </div>
              )}

              <div className="pt-2 border-t border-border space-y-3">
                <NumField
                  label="Standard Closing Costs"
                  value={inp.closingCosts}
                  onChange={(n) => set("closingCosts", n)}
                  prefix="$"
                />
                <NumField
                  label="Extra Buydown Cost"
                  value={inp.extraBuydownCost}
                  onChange={(n) => set("extraBuydownCost", n)}
                  prefix="$"
                />
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Seller Credit"
                    value={inp.sellerCredit}
                    onChange={(n) => set("sellerCredit", n)}
                    prefix="$"
                  />
                  <NumField
                    label="Lender Credit"
                    value={inp.lenderCredit}
                    onChange={(n) => set("lenderCredit", n)}
                    prefix="$"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <Label className="text-hud text-[10px] text-muted-foreground">
                  Include math breakdown in PDF
                </Label>
                <Switch
                  checked={inp.includeMath}
                  onCheckedChange={(v) => set("includeMath", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* RESULTS */}
          <div className="lg:col-span-2 space-y-6">
            {/* Comparison cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border bg-panel/40">
                <CardHeader className="pb-2">
                  <div className="text-hud text-[10px] text-muted-foreground">OPTION A</div>
                  <CardTitle className="text-base">Standard Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-display text-3xl text-foreground">
                    {fmtUSD2(res.standardMonthly)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">per month · P&I</div>
                  <div className="mt-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rate</span>
                      <span>{fmtPct(inp.baseRatePct)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Term</span>
                      <span>{inp.termYears} years</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Full-term P&I</span>
                      <span>{fmtUSD(res.standardMonthly * inp.termYears * 12)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-success/50 bg-success/5 ring-1 ring-success/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-success" />
                    <div className="text-hud text-[10px] text-success">OPTION B · RECOMMENDED</div>
                  </div>
                  <CardTitle className="text-base">Buydown Option</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-display text-3xl text-success">
                    {fmtUSD2(res.yearRows[0]?.monthlyPI ?? res.standardMonthly)}
                  </div>
                  <div className="text-xs text-success/80 mt-1">
                    Year 1 · saves {fmtUSD2(res.monthlySavingsYear1)}/mo
                  </div>
                  <div className="mt-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Note rate</span>
                      <span>{fmtPct(inp.baseRatePct)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Blended (buydown)</span>
                      <span>{fmtPct(res.blendedRatePct)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total savings</span>
                      <span className="text-success font-semibold">
                        {fmtUSD2(res.totalTempSavings)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Savings snapshot */}
            <Card className="border-border bg-panel/40">
              <CardHeader>
                <CardTitle className="text-display text-cyan flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" /> Savings Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "6 months", val: res.savings6mo },
                    { label: "9 months", val: res.savings9mo },
                    { label: "Year 1", val: res.year1Savings },
                    { label: "Total temp", val: res.totalTempSavings },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-md border border-success/20 bg-success/5 p-3"
                    >
                      <div className="text-hud text-[10px] text-muted-foreground">{s.label}</div>
                      <div className="text-display text-lg text-success mt-1">
                        {fmtUSD2(s.val)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-md border border-border bg-panel/30 p-3 text-sm">
                  <span className="text-hud text-[10px] text-muted-foreground block mb-1">
                    STILL AHEAD THROUGH
                  </span>
                  Borrower stays ahead through month{" "}
                  <span className="text-success font-semibold">{res.staysAheadThroughMonth}</span>;
                  ties at month <span className="font-semibold">{res.tiesAtMonth}</span>.
                  {res.netBuydownCost > 0 && (
                    <div className="mt-1 text-muted-foreground">
                      Out-of-pocket buydown cost {fmtUSD2(res.netBuydownCost)}
                      {res.breakEvenMonths
                        ? ` recovers in ~${res.breakEvenMonths} months.`
                        : ` not fully recovered within buydown period.`}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Year by year */}
            <Card className="border-border bg-panel/40">
              <CardHeader>
                <CardTitle className="text-display text-cyan">Year-by-Year Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead className="text-right">Monthly P&I</TableHead>
                      <TableHead className="text-right">Savings/mo</TableHead>
                      <TableHead className="text-right">Annual Savings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.yearRows.map((r) => (
                      <TableRow key={r.year}>
                        <TableCell>Year {r.year}</TableCell>
                        <TableCell>{fmtPct(r.ratePct)}</TableCell>
                        <TableCell className="text-right">{fmtUSD2(r.monthlyPI)}</TableCell>
                        <TableCell className="text-right text-success">
                          {fmtUSD2(r.monthlySavings)}
                        </TableCell>
                        <TableCell className="text-right text-success font-semibold">
                          {fmtUSD2(r.annualSavings)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-cyan/30">
                      <TableCell className="font-semibold">
                        Year {res.buydownPeriodYears + 1}+
                      </TableCell>
                      <TableCell>{fmtPct(inp.baseRatePct)}</TableCell>
                      <TableCell className="text-right">{fmtUSD2(res.standardMonthly)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {inp.includeMath && (
              <Card className="border-border bg-panel/40">
                <CardHeader>
                  <CardTitle className="text-display text-cyan">Math Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3 font-mono">
                  <div>
                    <div className="text-hud text-[10px] text-muted-foreground mb-1">FORMULA</div>
                    M = P × r(1+r)^n / ((1+r)^n − 1)
                  </div>
                  <div>
                    <div className="text-hud text-[10px] text-muted-foreground mb-1">
                      PLUGGED IN
                    </div>
                    P = {fmtUSD(inp.loanAmount)} · r ={" "}
                    {(inp.baseRatePct / 100 / 12).toFixed(8)} · n = {inp.termYears * 12}
                    <br />
                    Standard M = {fmtUSD2(res.standardMonthly)}
                  </div>
                  <div>
                    <div className="text-hud text-[10px] text-muted-foreground mb-1">
                      BLENDED RATE
                    </div>
                    ({res.yearRows.map((r) => r.ratePct.toFixed(3)).join("% + ")}%) /{" "}
                    {res.buydownPeriodYears} = {fmtPct(res.blendedRatePct)}
                  </div>
                  {res.netBuydownCost > 0 && (
                    <div>
                      <div className="text-hud text-[10px] text-muted-foreground mb-1">
                        BREAK-EVEN
                      </div>
                      Net cost {fmtUSD2(res.netBuydownCost)} ÷ {fmtUSD2(res.monthlySavingsYear1)}
                      /mo ≈ {res.breakEvenMonths ?? "N/A"} months
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-warn/30 bg-warn/5">
              <CardContent className="pt-6 text-xs text-muted-foreground leading-relaxed">
                <strong className="text-warn">Disclaimer.</strong> {DISCLAIMER}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
