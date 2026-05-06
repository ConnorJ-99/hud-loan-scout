import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  type BuydownInputs,
  type BuydownResult,
  fmtUSD,
  fmtUSD2,
  fmtPct,
  DISCLAIMER,
} from "./buydown";

const NAVY: [number, number, number] = [15, 27, 61];
const CYAN: [number, number, number] = [0, 150, 180];
const GREEN: [number, number, number] = [0, 140, 80];
const MUTED: [number, number, number] = [110, 120, 135];
const LIGHT: [number, number, number] = [240, 244, 248];

export function generateBuydownPDF(inp: BuydownInputs, res: BuydownResult): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 48;

  const header = (title: string, subtitle: string) => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 90, "F");
    doc.setFillColor(...CYAN);
    doc.rect(0, 90, W, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(title, margin, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(180, 210, 230);
    doc.text(subtitle, margin, 66);
    doc.setTextColor(0, 0, 0);
  };

  const footer = () => {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(DISCLAIMER, W - margin * 2);
    doc.text(lines, margin, H - 50);
    doc.setTextColor(0, 0, 0);
  };

  // ===== PAGE 1: SUMMARY =====
  header("Personalized Buydown Guide", `${inp.transactionType} · ${inp.termYears}-Year Loan`);

  let y = 120;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text("Loan Snapshot", margin, y);
  y += 8;
  doc.setDrawColor(...CYAN);
  doc.setLineWidth(1);
  doc.line(margin, y, margin + 80, y);
  y += 16;

  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 4 },
    body: [
      ["Loan Amount", fmtUSD(inp.loanAmount)],
      ["Term", `${inp.termYears} years`],
      ["First Payment", inp.firstPaymentDate],
      ["Note Rate", fmtPct(inp.baseRatePct)],
      ["Buydown Type", inp.buydownType === "custom" ? "Custom" : `${inp.buydownType} Buydown`],
      ["Buydown Period", `${res.buydownPeriodYears} year${res.buydownPeriodYears === 1 ? "" : "s"}`],
      ["Blended Rate (buydown period)", fmtPct(res.blendedRatePct)],
    ],
    columnStyles: { 0: { fontStyle: "bold", textColor: NAVY, cellWidth: 220 }, 1: { textColor: [40, 40, 40] } },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error lastAutoTable injected
  y = doc.lastAutoTable.finalY + 24;

  // Comparison cards
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text("Payment Comparison", margin, y);
  y += 16;

  const cardW = (W - margin * 2 - 20) / 2;
  const cardH = 130;
  // Option A
  doc.setDrawColor(...MUTED);
  doc.setFillColor(...LIGHT);
  doc.roundedRect(margin, y, cardW, cardH, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("OPTION A · STANDARD RATE", margin + 12, y + 22);
  doc.setFontSize(28);
  doc.text(fmtUSD2(res.standardMonthly), margin + 12, y + 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Rate: ${fmtPct(inp.baseRatePct)}`, margin + 12, y + 82);
  doc.text(`Full-term P&I (all ${inp.termYears} years)`, margin + 12, y + 100);

  // Option B
  const bx = margin + cardW + 20;
  doc.setFillColor(220, 245, 230);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(1.5);
  doc.roundedRect(bx, y, cardW, cardH, 6, 6, "FD");
  doc.setLineWidth(1);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GREEN);
  doc.text("OPTION B · BUYDOWN  ★ RECOMMENDED", bx + 12, y + 22);
  doc.setFontSize(28);
  doc.setTextColor(...NAVY);
  doc.text(fmtUSD2(res.yearRows[0]?.monthlyPI ?? res.standardMonthly), bx + 12, y + 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN);
  doc.text(
    `Year 1 saves ${fmtUSD2(res.monthlySavingsYear1)}/mo`,
    bx + 12,
    y + 82,
  );
  doc.setTextColor(...MUTED);
  doc.text(`Note rate: ${fmtPct(inp.baseRatePct)} after buydown`, bx + 12, y + 100);

  y += cardH + 24;

  // Savings highlights
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text("Your Savings", margin, y);
  y += 14;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 6 },
    head: [["Window", "Savings"]],
    body: [
      ["First 6 months", fmtUSD2(res.savings6mo)],
      ["First 9 months", fmtUSD2(res.savings9mo)],
      ["First 12 months (Year 1)", fmtUSD2(res.year1Savings)],
      ...(res.year2Savings ? [["Year 2", fmtUSD2(res.year2Savings)]] : []),
      ...(res.year3Savings ? [["Year 3", fmtUSD2(res.year3Savings)]] : []),
      ["Total temporary buydown savings", fmtUSD2(res.totalTempSavings)],
    ],
    columnStyles: { 1: { halign: "right", fontStyle: "bold", textColor: GREEN } },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 18;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const recText =
    `Recommendation: The buydown lowers your payment by ${fmtUSD2(res.monthlySavingsYear1)} per month in year 1, ` +
    `freeing up ${fmtUSD2(res.year1Savings)} of cash flow during your first year of ownership. ` +
    (res.netBuydownCost > 0 && res.breakEvenMonths
      ? `Out-of-pocket cost recovers in ${res.breakEvenMonths} months.`
      : `No out-of-pocket cost to the borrower for the buydown.`);
  const recLines = doc.splitTextToSize(recText, W - margin * 2);
  doc.text(recLines, margin, y);

  footer();

  // ===== PAGE 2: SCHEDULE =====
  doc.addPage();
  header("Year-by-Year Schedule", "How your payment changes over time");

  y = 120;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 6 },
    head: [["Year", "Rate", "Monthly P&I", "vs. Standard", "Annual Savings"]],
    body: [
      ...res.yearRows.map((r) => [
        `Year ${r.year}`,
        fmtPct(r.ratePct),
        fmtUSD2(r.monthlyPI),
        `−${fmtUSD2(r.monthlySavings)}/mo`,
        fmtUSD2(r.annualSavings),
      ]),
      [
        `Year ${res.buydownPeriodYears + 1}+`,
        fmtPct(inp.baseRatePct),
        fmtUSD2(res.standardMonthly),
        "—",
        "—",
      ],
    ],
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right", textColor: GREEN },
      4: { halign: "right", fontStyle: "bold", textColor: GREEN },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text("Break-Even & Stay-Ahead", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const breakEvenText =
    res.netBuydownCost > 0
      ? res.breakEvenMonths
        ? `You pay ${fmtUSD2(res.netBuydownCost)} extra up-front for the buydown. Monthly savings recover that cost in approximately ${res.breakEvenMonths} months.`
        : `Up-front buydown cost of ${fmtUSD2(res.netBuydownCost)} is not fully recovered by monthly savings within the buydown period.`
      : `There is no out-of-pocket buydown cost (covered by seller/lender credit). Every month of savings is pure benefit to you.`;

  doc.text(doc.splitTextToSize(breakEvenText, W - margin * 2), margin, y);
  y += 36;

  const aheadText = `Borrower stays ahead through month ${res.staysAheadThroughMonth}; ties at month ${res.tiesAtMonth}. Buydown payments never exceed the standard payment, so there is no future "catch-up" cost.`;
  doc.text(doc.splitTextToSize(aheadText, W - margin * 2), margin, y);
  y += 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text("Plain-English Walkthrough", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const walk =
    `Your loan is a ${inp.termYears}-year fixed mortgage at ${fmtPct(inp.baseRatePct)}. With the ${
      inp.buydownType === "custom" ? "custom" : inp.buydownType
    } buydown, your interest rate is temporarily reduced for the first ${res.buydownPeriodYears} year${res.buydownPeriodYears === 1 ? "" : "s"}. ` +
    `That means your monthly payment starts at ${fmtUSD2(res.yearRows[0]?.monthlyPI ?? res.standardMonthly)} instead of ${fmtUSD2(res.standardMonthly)}. ` +
    `Each year your payment steps up until it reaches the full note-rate payment in year ${res.buydownPeriodYears + 1}. ` +
    `Across the buydown period you keep ${fmtUSD2(res.totalTempSavings)} in your pocket.`;
  doc.text(doc.splitTextToSize(walk, W - margin * 2), margin, y);

  footer();

  // ===== PAGE 3: MATH =====
  if (inp.includeMath) {
    doc.addPage();
    header("Math Breakdown", "How the numbers were calculated");

    y = 120;
    const n = inp.termYears * 12;
    const r = inp.baseRatePct / 100 / 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("1. Amortization Formula", margin, y);
    y += 16;
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text("M = P * r(1+r)^n / ((1+r)^n - 1)", margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.text(
      `Where P = ${fmtUSD(inp.loanAmount)}, r = monthly rate, n = ${n} months.`,
      margin,
      y,
    );
    y += 24;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("2. Standard Payment", margin, y);
    y += 16;
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(`r = ${inp.baseRatePct}% / 12 = ${r.toFixed(8)}`, margin, y);
    y += 14;
    doc.text(`M = ${fmtUSD2(res.standardMonthly)}`, margin, y);
    y += 24;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("3. Buydown Year Payments", margin, y);
    y += 6;

    autoTable(doc, {
      startY: y + 6,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 4, font: "courier" },
      head: [["Year", "Rate %", "Monthly r", "Monthly P&I", "Savings/mo"]],
      headStyles: { fillColor: NAVY, textColor: 255, font: "helvetica" },
      body: res.yearRows.map((row) => [
        `Y${row.year}`,
        row.ratePct.toFixed(3),
        (row.ratePct / 100 / 12).toFixed(8),
        fmtUSD2(row.monthlyPI),
        fmtUSD2(row.monthlySavings),
      ]),
      margin: { left: margin, right: margin },
    });

    // @ts-expect-error
    y = doc.lastAutoTable.finalY + 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("4. Blended Rate (buydown period)", margin, y);
    y += 16;
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const rateList = res.yearRows.map((r) => r.ratePct.toFixed(3)).join("% + ");
    doc.text(`(${rateList}%) / ${res.buydownPeriodYears} = ${fmtPct(res.blendedRatePct)}`, margin, y);
    y += 24;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("5. Break-Even", margin, y);
    y += 16;
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    if (res.netBuydownCost > 0) {
      doc.text(
        `Net buydown cost = ${fmtUSD2(inp.extraBuydownCost)} - ${fmtUSD2(inp.sellerCredit)} - ${fmtUSD2(inp.lenderCredit)} = ${fmtUSD2(res.netBuydownCost)}`,
        margin,
        y,
      );
      y += 14;
      doc.text(
        `Break-even ≈ ${res.breakEvenMonths ?? "N/A"} months at ${fmtUSD2(res.monthlySavingsYear1)}/mo Y1 savings`,
        margin,
        y,
      );
    } else {
      doc.text(`Net buydown cost = $0 (credits cover the cost). No break-even required.`, margin, y);
    }

    footer();
  }

  return doc;
}
