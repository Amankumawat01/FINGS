/* =========================================================
   FINGS — utilities
   ========================================================= */
window.FINGS = window.FINGS || {};

FINGS.util = {

  formatMoney(n) {
    const num = Number(n) || 0;
    const sign = num < 0 ? "-" : "";
    const abs = Math.abs(num);
    return sign + "₹" + abs.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  },

  formatMoneySigned(n) {
    const num = Number(n) || 0;
    return (num >= 0 ? "+" : "-") + "₹" + Math.abs(num).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  },

  todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  },

  thisMonthStr() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 7); // YYYY-MM
  },

  formatDatePretty(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  },

  monthLabel(monthStr) {
    const [y, m] = monthStr.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  },

  genId(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  async sha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  },

  toast(msg, ms) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(FINGS._toastTimer);
    FINGS._toastTimer = setTimeout(() => el.classList.add("hidden"), ms || 2200);
  },

  escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
};
