/* =========================================================
   FINGS — PDF report generation (jsPDF + autotable)
   ========================================================= */
window.FINGS = window.FINGS || {};

FINGS.pdf = (function () {

  const STATUS_LABEL = { paid: "Paid", partial: "Partial", unpaid: "Unpaid", received: "Received", notreceived: "Not Received" };

  function newDoc(title, subtitle) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("FINGS", 40, 46);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(title, 40, 64);
    if (subtitle) {
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(subtitle, 40, 78);
      doc.setTextColor(20);
    }
    return doc;
  }

  function addSectionTable(doc, startY, heading, head, rows, emptyLabel) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(heading, 40, startY);
    if (!rows.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(130);
      doc.text(emptyLabel || "No entries.", 40, startY + 16);
      doc.setTextColor(20);
      return startY + 34;
    }
    doc.autoTable({
      startY: startY + 8,
      head: [head],
      body: rows,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [22, 40, 61] },
      margin: { left: 40, right: 40 }
    });
    return doc.lastAutoTable.finalY + 24;
  }

  function summaryBlock(doc, startY, pairs) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 40, startY);
    doc.autoTable({
      startY: startY + 8,
      body: pairs,
      styles: { fontSize: 10, cellPadding: 5 },
      theme: "plain",
      margin: { left: 40, right: 40 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } }
    });
    return doc.lastAutoTable.finalY + 20;
  }

  function generateDailyReport(iso) {
    const d = FINGS.data.entriesForDay(iso);
    const bal = FINGS.data.dailyBalances(iso);
    const money = FINGS.util.formatMoney;
    const dateLabel = FINGS.util.formatDatePretty(iso);
    const doc = newDoc("Daily Report", dateLabel);

    let y = summaryBlock(doc, 100, [
      ["Opening Balance", money(bal.opening)],
      ["Closing Balance", money(bal.closing)],
      ["Total Sale", money(d.sales.reduce((s, t) => s + Number(t.amount), 0))],
      ["Total Purchase", money(d.purchases.reduce((s, t) => s + Number(t.amount), 0))],
      ["Total Expense", money(d.expenses.reduce((s, t) => s + Number(t.amount), 0))],
      ["Payment In", money(d.paymentsIn.reduce((s, t) => s + Number(t.amount), 0))],
      ["Payment Out", money(d.paymentsOut.reduce((s, t) => s + Number(t.amount), 0))]
    ]);

    y = addSectionTable(doc, y, "Sales", ["Date", "Invoice No.", "Description", "Status", "Amount"],
      d.sales.map(t => [dateLabel, t.invoiceNo || "-", t.description || "-", STATUS_LABEL[t.paymentStatus] || "Not Received", money(t.amount)]),
      "No sales recorded.");
    y = addSectionTable(doc, y, "Purchases", ["Date", "Invoice No.", "Description", "Status", "Amount"],
      d.purchases.map(t => [dateLabel, t.invoiceNo || "-", t.description || "-", STATUS_LABEL[t.paymentStatus] || "Unpaid", money(t.amount)]),
      "No purchases recorded.");
    y = addSectionTable(doc, y, "Expenses", ["Date", "Description", "Amount"],
      d.expenses.map(t => [dateLabel, t.description || "-", money(t.amount)]), "No expenses recorded.");
    y = addSectionTable(doc, y, "Payment In", ["Date", "Party", "Invoice No.", "Amount"],
      d.paymentsIn.map(p => [dateLabel, p.partyName || "-", p.invoiceNo || "-", money(p.amount)]), "No payments received.");
    y = addSectionTable(doc, y, "Payment Out", ["Date", "Party", "Invoice No.", "Amount"],
      d.paymentsOut.map(p => [dateLabel, p.partyName || "-", p.invoiceNo || "-", money(p.amount)]), "No payments made.");

    doc.save(`FINGS-Daily-Report-${iso}.pdf`);
  }

  function generateMonthlyReport(monthStr) {
    const d = FINGS.data.entriesForMonth(monthStr);
    const bal = FINGS.data.monthlyBalances(monthStr);
    const money = FINGS.util.formatMoney;
    const totals = FINGS.data.computeTotals(monthStr);
    const doc = newDoc("Monthly Report", FINGS.util.monthLabel(monthStr));

    let y = summaryBlock(doc, 100, [
      ["Opening Balance", money(bal.opening)],
      ["Closing Balance", money(bal.closing)],
      ["Total Sale", money(totals.sale)],
      ["Total Purchase", money(totals.purchase)],
      ["Total Expense", money(totals.expense)],
      ["Payment In", money(totals.paymentIn)],
      ["Payment Out", money(totals.paymentOut)],
      ["Net Cash Flow", money(totals.paymentIn - totals.paymentOut - totals.expense)]
    ]);

    y = addSectionTable(doc, y, "Sales", ["Date", "Invoice No.", "Description", "Status", "Amount"],
      d.sales.map(t => [FINGS.util.formatDatePretty(t.date), t.invoiceNo || "-", t.description || "-", STATUS_LABEL[t.paymentStatus] || "Not Received", money(t.amount)]),
      "No sales this month.");
    y = addSectionTable(doc, y, "Purchases", ["Date", "Invoice No.", "Description", "Status", "Amount"],
      d.purchases.map(t => [FINGS.util.formatDatePretty(t.date), t.invoiceNo || "-", t.description || "-", STATUS_LABEL[t.paymentStatus] || "Unpaid", money(t.amount)]),
      "No purchases this month.");
    y = addSectionTable(doc, y, "Expenses", ["Date", "Description", "Amount"],
      d.expenses.map(t => [FINGS.util.formatDatePretty(t.date), t.description || "-", money(t.amount)]), "No expenses this month.");
    y = addSectionTable(doc, y, "Payment In", ["Date", "Party", "Invoice No.", "Amount"],
      d.paymentsIn.map(p => [FINGS.util.formatDatePretty(p.date), p.partyName || "-", p.invoiceNo || "-", money(p.amount)]), "No payments received this month.");
    y = addSectionTable(doc, y, "Payment Out", ["Date", "Party", "Invoice No.", "Amount"],
      d.paymentsOut.map(p => [FINGS.util.formatDatePretty(p.date), p.partyName || "-", p.invoiceNo || "-", money(p.amount)]), "No payments made this month.");

    doc.save(`FINGS-Monthly-Report-${monthStr}.pdf`);
  }

  return { generateDailyReport, generateMonthlyReport };
})();