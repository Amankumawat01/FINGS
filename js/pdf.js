/* =========================================================
   FINGS — PDF report generation (jsPDF + autotable)
   ========================================================= */
window.FINGS = window.FINGS || {};

FINGS.pdf = (function () {

  function pdfMoney(n) {
    const num = Number(n) || 0;
    const sign = num < 0 ? "-" : "";
    return sign + "Rs. " + Math.abs(num).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    });
  }

  function linkedLabel(payment) {
    if (!payment.linkedTransactionId) return "-";
    const tx = FINGS.data.state.transactions.find(t => t.id === payment.linkedTransactionId);
    if (!tx) return "Linked invoice";
    const label = tx.type === "sale" ? "Sale" : tx.type === "purchase" ? "Purchase" : "Entry";
    return `${label}: ${tx.description || "-"} (${pdfMoney(tx.amount)})`;
  }

  function totalAmount(rows) {
    return rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

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
      styles: { fontSize: 8.5, cellPadding: 5, overflow: "linebreak" },
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
    const doc = newDoc("Daily Report", FINGS.util.formatDatePretty(iso));

    let y = summaryBlock(doc, 100, [
      ["Total Sale", pdfMoney(totalAmount(d.sales))],
      ["Total Purchase", pdfMoney(totalAmount(d.purchases))],
      ["Total Expense", pdfMoney(totalAmount(d.expenses))],
      ["Payment In", pdfMoney(totalAmount(d.paymentsIn))],
      ["Payment Out", pdfMoney(totalAmount(d.paymentsOut))]
    ]);

    y = addSectionTable(doc, y, "Sales", ["#", "Description / Bill", "Amount"],
      d.sales.map((t, i) => [i + 1, t.description || "-", pdfMoney(t.amount)]), "No sales recorded.");
    y = addSectionTable(doc, y, "Purchases", ["#", "Description / Bill", "Amount"],
      d.purchases.map((t, i) => [i + 1, t.description || "-", pdfMoney(t.amount)]), "No purchases recorded.");
    y = addSectionTable(doc, y, "Expenses", ["#", "Description", "Amount"],
      d.expenses.map((t, i) => [i + 1, t.description || "-", pdfMoney(t.amount)]), "No expenses recorded.");
    y = addSectionTable(doc, y, "Payment In", ["#", "Party", "Invoice No.", "Linked Bill", "Amount"],
      d.paymentsIn.map((p, i) => [i + 1, p.partyName || "-", p.invoiceNo || "-", linkedLabel(p), pdfMoney(p.amount)]), "No payments received.");
    y = addSectionTable(doc, y, "Payment Out", ["#", "Party", "Invoice No.", "Linked Bill", "Amount"],
      d.paymentsOut.map((p, i) => [i + 1, p.partyName || "-", p.invoiceNo || "-", linkedLabel(p), pdfMoney(p.amount)]), "No payments made.");

    doc.save(`FINGS-Daily-Report-${iso}.pdf`);
  }

  function generateMonthlyReport(monthStr) {
    const d = FINGS.data.entriesForMonth(monthStr);
    const totals = FINGS.data.computeTotals(monthStr);
    const doc = newDoc("Monthly Report", FINGS.util.monthLabel(monthStr));

    let y = summaryBlock(doc, 100, [
      ["Total Sale", pdfMoney(totals.sale)],
      ["Total Purchase", pdfMoney(totals.purchase)],
      ["Total Expense", pdfMoney(totals.expense)],
      ["Payment In", pdfMoney(totals.paymentIn)],
      ["Payment Out", pdfMoney(totals.paymentOut)],
      ["Net Cash Flow", pdfMoney(totals.paymentIn - totals.paymentOut - totals.expense)]
    ]);

    y = addSectionTable(doc, y, "Sales", ["#", "Date", "Description / Bill", "Amount"],
      d.sales.map((t, i) => [i + 1, FINGS.util.formatDatePretty(t.date), t.description || "-", pdfMoney(t.amount)]), "No sales this month.");
    y = addSectionTable(doc, y, "Purchases", ["#", "Date", "Description / Bill", "Amount"],
      d.purchases.map((t, i) => [i + 1, FINGS.util.formatDatePretty(t.date), t.description || "-", pdfMoney(t.amount)]), "No purchases this month.");
    y = addSectionTable(doc, y, "Expenses", ["#", "Date", "Description", "Amount"],
      d.expenses.map((t, i) => [i + 1, FINGS.util.formatDatePretty(t.date), t.description || "-", pdfMoney(t.amount)]), "No expenses this month.");
    y = addSectionTable(doc, y, "Payment In", ["#", "Date", "Party", "Invoice No.", "Linked Bill", "Amount"],
      d.paymentsIn.map((p, i) => [i + 1, FINGS.util.formatDatePretty(p.date), p.partyName || "-", p.invoiceNo || "-", linkedLabel(p), pdfMoney(p.amount)]), "No payments received this month.");
    y = addSectionTable(doc, y, "Payment Out", ["#", "Date", "Party", "Invoice No.", "Linked Bill", "Amount"],
      d.paymentsOut.map((p, i) => [i + 1, FINGS.util.formatDatePretty(p.date), p.partyName || "-", p.invoiceNo || "-", linkedLabel(p), pdfMoney(p.amount)]), "No payments made this month.");

    doc.save(`FINGS-Monthly-Report-${monthStr}.pdf`);
  }

  return { generateDailyReport, generateMonthlyReport };
})();
