/* =========================================================
   FINGS — reports view
   ========================================================= */
window.FINGS = window.FINGS || {};

FINGS.reports = (function () {

  function selectedMonth() {
    return document.getElementById("report-month").value || FINGS.util.thisMonthStr();
  }

  function render() {
    const monthStr = selectedMonth();
    const totals = FINGS.data.computeTotals(monthStr);
    const net = totals.paymentIn - totals.paymentOut - totals.expense;

    document.getElementById("report-sale").textContent = FINGS.util.formatMoney(totals.sale);
    document.getElementById("report-purchase").textContent = FINGS.util.formatMoney(totals.purchase);
    document.getElementById("report-expense").textContent = FINGS.util.formatMoney(totals.expense);
    document.getElementById("report-net").textContent = FINGS.util.formatMoney(net);
    document.getElementById("report-payin").textContent = FINGS.util.formatMoney(totals.paymentIn);
    document.getElementById("report-payout").textContent = FINGS.util.formatMoney(totals.paymentOut);

    const netEl = document.getElementById("report-net");
    netEl.className = "mono " + (net >= 0 ? "accent-emerald" : "accent-coral");
    netEl.classList.add("stat-box-value");

    const feed = FINGS.dashboard.mergedFeed().filter(e => (e.date || "").slice(0, 7) === monthStr);
    const list = document.getElementById("report-list");
    list.innerHTML = feed.length
      ? feed.map(FINGS.dashboard.rowHtml).join("")
      : `<p class="empty-state">No entries for this month yet.</p>`;
  }

  function bindEvents() {
    const monthInput = document.getElementById("report-month");
    monthInput.value = FINGS.util.thisMonthStr();
    monthInput.addEventListener("change", render);

    document.getElementById("monthly-report-btn").addEventListener("click", () => {
      FINGS.pdf.generateMonthlyReport(selectedMonth());
    });
  }

  return { render, bindEvents };
})();
