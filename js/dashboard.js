/* =========================================================
   FINGS — dashboard view
   ========================================================= */
window.FINGS = window.FINGS || {};

FINGS.dashboard = (function () {

  const TYPE_META = {
    sale: { label: "Sale", icon: "S", bg: "var(--ledger-emerald-bg)", fg: "var(--ledger-emerald)" },
    purchase: { label: "Purchase", icon: "P", bg: "var(--ledger-gold-bg)", fg: "var(--ledger-gold)" },
    expense: { label: "Expense", icon: "E", bg: "var(--signal-coral-bg)", fg: "var(--signal-coral)" },
    "payment-in": { label: "Payment In", icon: "↓", bg: "var(--ledger-emerald-bg)", fg: "var(--ledger-emerald)" },
    "payment-out": { label: "Payment Out", icon: "↑", bg: "var(--signal-coral-bg)", fg: "var(--signal-coral)" }
  };

  const STATUS_META = {
    paid: { label: "Paid", cls: "status-paid" },
    partial: { label: "Partial", cls: "status-partial" },
    unpaid: { label: "Unpaid", cls: "status-unpaid" }
  };

  function mergedFeed() {
    const tx = FINGS.data.state.transactions.map(t => ({ kind: "tx", ...t }));
    const pay = FINGS.data.state.payments.map(p => ({ kind: "pay", ...p, type: p.type === "in" ? "payment-in" : "payment-out" }));
    return tx.concat(pay).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function rowHtml(entry) {
    const meta = TYPE_META[entry.type] || TYPE_META.sale;
    const isOutflow = entry.type === "purchase" || entry.type === "expense" || entry.type === "payment-out";
    const amountStr = FINGS.util.formatMoneySigned(isOutflow ? -Math.abs(entry.amount) : Math.abs(entry.amount));
    const title = entry.kind === "pay" ? (entry.partyName || "Unnamed party") : (entry.description || "Untitled");

    const subParts = [FINGS.util.formatDatePretty(entry.date)];
    const invoiceNo = entry.invoiceNo;
    if (invoiceNo) subParts.push("Inv #" + FINGS.util.escapeHtml(invoiceNo));

    let statusChip = "";
    if (entry.kind === "tx" && (entry.type === "sale" || entry.type === "purchase")) {
      const status = STATUS_META[entry.paymentStatus] || STATUS_META.unpaid;
      statusChip = `<span class="tx-chip ${status.cls}">${status.label}</span>`;
    }

    const delAction = entry.kind === "pay" ? "delete-payment" : "delete-tx";

    return `
      <div class="tx-row">
        <div class="tx-icon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</div>
        <div class="tx-main">
          <div class="tx-title">${FINGS.util.escapeHtml(title)}</div>
          <div class="tx-sub">
            <span>${meta.label}</span>
            <span>·</span>
            <span>${subParts.join(" · ")}</span>
          </div>
        </div>
        <div class="tx-amount-col">
          <span class="tx-amount" style="color:${meta.fg}">${amountStr}</span>
          <div class="tx-actions">
            ${statusChip}
            <button class="tx-del" data-action="${delAction}" data-id="${entry.id}" title="Delete">🗑</button>
          </div>
        </div>
      </div>`;
  }

  function render() {
    const biz = FINGS.data.state.business;
    document.getElementById("stat-opening").textContent = FINGS.util.formatMoney(biz.openingBalance || 0);
    document.getElementById("stat-actual").textContent = FINGS.util.formatMoney(FINGS.data.actualBalance());

    const totals = FINGS.data.computeTotals(FINGS.util.thisMonthStr());
    document.getElementById("stat-sale").textContent = FINGS.util.formatMoney(totals.sale);
    document.getElementById("stat-purchase").textContent = FINGS.util.formatMoney(totals.purchase);
    document.getElementById("stat-expense").textContent = FINGS.util.formatMoney(totals.expense);

    const feed = mergedFeed().slice(0, 30);
    const list = document.getElementById("transaction-list");
    if (!feed.length) {
      list.innerHTML = `<p class="empty-state">Nothing recorded yet. Tap + to add a sale, purchase, expense or payment.</p>`;
    } else {
      list.innerHTML = feed.map(rowHtml).join("");
    }
  }

  // ---------- forms ----------
  function txFormHtml(type) {
    const meta = TYPE_META[type];
    const hasInvoice = type === "sale" || type === "purchase";
    return `
      <h3 style="margin:0 0 14px;font-family:var(--font-display)">${meta.label}</h3>
      <form id="entry-form">
        <label class="field"><span>Description</span>
          <input type="text" id="f-description" placeholder="What was this for?" required></label>
        ${hasInvoice ? `
        <label class="field"><span>Invoice No.</span>
          <input type="text" id="f-invoice" placeholder="Optional"></label>` : ""}
        <label class="field"><span>Amount</span>
          <input type="number" id="f-amount" inputmode="decimal" placeholder="0" required min="0.01" step="0.01"></label>
        <label class="field"><span>Date</span>
          <input type="date" id="f-date" value="${FINGS.util.todayISO()}" required></label>
        ${hasInvoice ? `
        <label class="field"><span>Payment Status</span>
          <select id="f-status">
            <option value="unpaid" selected>Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select></label>` : ""}
        <button type="submit" class="btn btn-primary btn-block" style="margin-top:6px">Save ${meta.label}</button>
      </form>`;
  }

  function paymentFormHtml(type) {
    const meta = TYPE_META[type];
    return `
      <h3 style="margin:0 0 14px;font-family:var(--font-display)">${meta.label}</h3>
      <form id="entry-form">
        <label class="field"><span>Party Name</span>
          <input type="text" id="f-party" placeholder="Who paid / was paid?" required></label>
        <label class="field"><span>Invoice No.</span>
          <input type="text" id="f-invoice" placeholder="Optional"></label>
        <label class="field"><span>Date</span>
          <input type="date" id="f-date" value="${FINGS.util.todayISO()}" required></label>
        <label class="field"><span>Amount</span>
          <input type="number" id="f-amount" inputmode="decimal" placeholder="0" required min="0.01" step="0.01"></label>
        <button type="submit" class="btn btn-primary btn-block" style="margin-top:6px">Save ${meta.label}</button>
      </form>`;
  }

  function openSheet(html, onSubmit) {
    document.getElementById("sheet-body").innerHTML = html;
    document.getElementById("sheet-overlay").classList.remove("hidden");
    document.getElementById("bottom-sheet").classList.remove("hidden");
    const form = document.getElementById("entry-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await onSubmit();
        FINGS.closeSheet();
      } catch (err) {
        FINGS.util.toast(err.message || "Something went wrong.");
        btn.disabled = false;
      }
    });
  }

  function openAddForm(type) {
    if (type === "sale" || type === "purchase" || type === "expense") {
      openSheet(txFormHtml(type), async () => {
        const hasInvoice = type === "sale" || type === "purchase";
        await FINGS.data.addTransaction({
          type,
          description: document.getElementById("f-description").value.trim(),
          invoiceNo: hasInvoice ? document.getElementById("f-invoice").value.trim() : "",
          paymentStatus: hasInvoice ? document.getElementById("f-status").value : undefined,
          amount: document.getElementById("f-amount").value,
          date: document.getElementById("f-date").value
        });
        FINGS.util.toast(TYPE_META[type].label + " added");
      });
    } else if (type === "payment-in" || type === "payment-out") {
      openSheet(paymentFormHtml(type), async () => {
        await FINGS.data.addPayment({
          type: type === "payment-in" ? "in" : "out",
          partyName: document.getElementById("f-party").value.trim(),
          invoiceNo: document.getElementById("f-invoice").value.trim(),
          date: document.getElementById("f-date").value,
          amount: document.getElementById("f-amount").value
        });
        FINGS.util.toast(TYPE_META[type].label + " recorded");
      });
    }
  }

  function bindEvents() {
    document.getElementById("transaction-list").addEventListener("click", handleListClick);
    document.getElementById("report-list") && document.getElementById("report-list").addEventListener("click", handleListClick);

    document.getElementById("daily-report-date").value = FINGS.util.todayISO();
    document.getElementById("daily-report-btn").addEventListener("click", () => {
      const iso = document.getElementById("daily-report-date").value || FINGS.util.todayISO();
      FINGS.pdf.generateDailyReport(iso);
    });
  }

  async function handleListClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "delete-tx") {
      if (confirm("Delete this entry?")) {
        await FINGS.data.deleteTransaction(btn.dataset.id);
        FINGS.util.toast("Deleted");
      }
    } else if (action === "delete-payment") {
      if (confirm("Delete this payment?")) {
        await FINGS.data.deletePayment(btn.dataset.id);
        FINGS.util.toast("Deleted");
      }
    }
  }

  return { render, bindEvents, openAddForm, rowHtml, mergedFeed };
})();