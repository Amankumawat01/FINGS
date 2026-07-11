/* =========================================================
   FINGS — data layer (Firestore)
   Collections:
     config/business   { name, openingBalance, manualAdjustment }
     transactions/{id} { type: sale|purchase|expense, description,
                          invoiceNo, paymentStatus, amount, date, createdAt }
                        (invoiceNo/paymentStatus only used for sale/purchase)
     payments/{id}     { type: in|out, partyName, invoiceNo, date,
                          amount, createdAt }
     users/{username}  { username, passwordHash, name, role, createdAt }
   ========================================================= */
window.FINGS = window.FINGS || {};

FINGS.data = (function () {
  let db = null;
  let unsubs = [];

  const state = {
    business: { name: "", openingBalance: 0, manualAdjustment: 0 },
    transactions: [],   // sales / purchases / expenses
    payments: [],       // payment in / out
    users: [],
    ready: { business: false, transactions: false, payments: false, users: false }
  };

  async function init() {
    if (db) return db;
    firebase.initializeApp(FINGS_FIREBASE_CONFIG);
    db = firebase.firestore();
    // Sign in anonymously so Firestore security rules can require
    // request.auth != null instead of being left wide open. This is a
    // baseline guard, not per-user permissioning — see README.md.
    try {
      await firebase.auth().signInAnonymously();
    } catch (err) {
      console.warn("Anonymous auth failed (is it enabled in Firebase console?)", err);
      throw err;
    }
    return db;
  }

  async function ensureSeedAdmin() {
    const ref = db.collection("users").doc(FINGS_ADMIN_USERNAME);
    const snap = await ref.get();
    if (!snap.exists) {
      const hash = await FINGS.util.sha256(FINGS_ADMIN_PASSWORD);
      await ref.set({
        username: FINGS_ADMIN_USERNAME,
        passwordHash: hash,
        name: "Admin",
        role: "admin",
        createdAt: Date.now()
      });
    }
    const bizRef = db.collection("config").doc("business");
    const bizSnap = await bizRef.get();
    if (!bizSnap.exists) {
      await bizRef.set({ name: "My Business", openingBalance: 0, manualAdjustment: 0 });
    }
  }

  function subscribeAll(onChange) {
    unsubs.forEach(u => u());
    unsubs = [];

    unsubs.push(db.collection("config").doc("business").onSnapshot(snap => {
      if (snap.exists) state.business = snap.data();
      state.ready.business = true;
      onChange("business");
    }));

    unsubs.push(db.collection("transactions").orderBy("date", "desc").onSnapshot(snap => {
      state.transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      state.ready.transactions = true;
      onChange("transactions");
    }, err => console.error("transactions listener", err)));

    unsubs.push(db.collection("payments").orderBy("date", "desc").onSnapshot(snap => {
      state.payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      state.ready.payments = true;
      onChange("payments");
    }, err => console.error("payments listener", err)));

    unsubs.push(db.collection("users").onSnapshot(snap => {
      state.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      state.ready.users = true;
      onChange("users");
    }, err => console.error("users listener", err)));
  }

  function teardown() {
    unsubs.forEach(u => u());
    unsubs = [];
  }

  // ---------- transactions (sale / purchase / expense) ----------
  async function addTransaction({ type, description, invoiceNo, paymentStatus, amount, date }) {
    const payload = {
      type, description, amount: Number(amount), date,
      createdAt: Date.now()
    };
    // invoice number & payment status only apply to sale/purchase, not expense
    if (type === "sale" || type === "purchase") {
      payload.invoiceNo = invoiceNo || "";
      payload.paymentStatus = paymentStatus || "unpaid";
    }
    await db.collection("transactions").add(payload);
  }

  async function deleteTransaction(id) {
    await db.collection("transactions").doc(id).delete();
  }

  // ---------- payments (in / out) ----------
  async function addPayment({ type, partyName, invoiceNo, date, amount }) {
    await db.collection("payments").add({
      type, partyName: partyName || "", invoiceNo: invoiceNo || "",
      date, amount: Number(amount),
      createdAt: Date.now()
    });
  }

  async function deletePayment(id) {
    await db.collection("payments").doc(id).delete();
  }

  // ---------- users ----------
  async function addUser({ username, password, name, role }) {
    const ref = db.collection("users").doc(username);
    const existing = await ref.get();
    if (existing.exists) throw new Error("That username is already taken.");
    const hash = await FINGS.util.sha256(password);
    await ref.set({
      username, passwordHash: hash, name: name || username,
      role: role === "admin" ? "admin" : "staff",
      createdAt: Date.now()
    });
  }

  async function findUser(username) {
    const snap = await db.collection("users").doc(username).get();
    return snap.exists ? snap.data() : null;
  }

  // ---------- business config ----------
  async function saveBusinessConfig({ name, openingBalance, actualBalance }) {
    const totals = computeTotals();
    const derivedBeforeAdjustment = Number(openingBalance) + totals.paymentIn - totals.paymentOut - totals.expense;
    const manualAdjustment = Number(actualBalance) - derivedBeforeAdjustment;
    await db.collection("config").doc("business").set({
      name: name || "", openingBalance: Number(openingBalance) || 0, manualAdjustment
    }, { merge: true });
  }

  // ---------- aggregation ----------
  function computeTotals(monthStr) {
    const inMonth = (iso) => !monthStr || (iso || "").slice(0, 7) === monthStr;

    const sale = state.transactions.filter(t => t.type === "sale" && inMonth(t.date))
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const purchase = state.transactions.filter(t => t.type === "purchase" && inMonth(t.date))
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = state.transactions.filter(t => t.type === "expense" && inMonth(t.date))
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const paymentIn = state.payments.filter(p => p.type === "in" && inMonth(p.date))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const paymentOut = state.payments.filter(p => p.type === "out" && inMonth(p.date))
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    return { sale, purchase, expense, paymentIn, paymentOut };
  }

  function actualBalance() {
    const allTime = computeTotals(); // no month filter = all-time
    return Number(state.business.openingBalance || 0)
      + allTime.paymentIn - allTime.paymentOut - allTime.expense
      + Number(state.business.manualAdjustment || 0);
  }

  // ---------- opening / closing balance as of a given date ----------
  // Balance = base opening balance + manual adjustment, plus every
  // payment-in/payment-out/expense dated on-or-before `iso`.
  function balanceThroughDate(iso) {
    const upTo = (d) => (d || "") <= iso;
    const paymentIn = state.payments.filter(p => p.type === "in" && upTo(p.date))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const paymentOut = state.payments.filter(p => p.type === "out" && upTo(p.date))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const expense = state.transactions.filter(t => t.type === "expense" && upTo(t.date))
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    return Number(state.business.openingBalance || 0)
      + Number(state.business.manualAdjustment || 0)
      + paymentIn - paymentOut - expense;
  }

  function dayBefore(iso) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function lastDayOfMonth(monthStr) {
    const [y, m] = monthStr.split("-").map(Number);
    return new Date(y, m, 0).toISOString().slice(0, 10); // day 0 of next month
  }

  function dailyBalances(iso) {
    return { opening: balanceThroughDate(dayBefore(iso)), closing: balanceThroughDate(iso) };
  }

  function monthlyBalances(monthStr) {
    const firstDay = monthStr + "-01";
    const lastDay = lastDayOfMonth(monthStr);
    return { opening: balanceThroughDate(dayBefore(firstDay)), closing: balanceThroughDate(lastDay) };
  }

  function entriesForDay(iso) {
    return {
      sales: state.transactions.filter(t => t.type === "sale" && t.date === iso),
      purchases: state.transactions.filter(t => t.type === "purchase" && t.date === iso),
      expenses: state.transactions.filter(t => t.type === "expense" && t.date === iso),
      paymentsIn: state.payments.filter(p => p.type === "in" && p.date === iso),
      paymentsOut: state.payments.filter(p => p.type === "out" && p.date === iso)
    };
  }

  function entriesForMonth(monthStr) {
    const inMonth = (iso) => (iso || "").slice(0, 7) === monthStr;
    return {
      sales: state.transactions.filter(t => t.type === "sale" && inMonth(t.date)),
      purchases: state.transactions.filter(t => t.type === "purchase" && inMonth(t.date)),
      expenses: state.transactions.filter(t => t.type === "expense" && inMonth(t.date)),
      paymentsIn: state.payments.filter(p => p.type === "in" && inMonth(p.date)),
      paymentsOut: state.payments.filter(p => p.type === "out" && inMonth(p.date))
    };
  }

  return {
    init, ensureSeedAdmin, subscribeAll, teardown,
    addTransaction, deleteTransaction,
    addPayment, deletePayment,
    addUser, findUser,
    saveBusinessConfig,
    computeTotals, actualBalance,
    dailyBalances, monthlyBalances,
    entriesForDay, entriesForMonth,
    state
  };
})();