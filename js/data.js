/* =========================================================
   FINGS — data layer (Firestore)
   Collections:
     config/business   { name, openingBalance, manualAdjustment }
     transactions/{id} { type: sale|purchase|expense, description,
                          amount, date, createdAt }
     payments/{id}     { type: in|out, partyName, invoiceNo, date,
                          amount, linkedTransactionId, createdAt }
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

  function assertFirebaseConfig() {
    if (typeof firebase === "undefined") {
      throw new Error("Firebase SDK did not load. Check your internet connection.");
    }
    if (typeof FINGS_isFirebaseConfigComplete !== "function" || !FINGS_isFirebaseConfigComplete(FINGS_FIREBASE_CONFIG)) {
      throw new Error("Firebase config is incomplete. Paste the Web App config into js/config.js.");
    }
  }

  function cleanUsername(username) {
    return String(username || "").trim();
  }

  function assertValidUsername(username) {
    if (!username) throw new Error("Username is required.");
    if (username.length > 40) throw new Error("Username must be 40 characters or less.");
    if (!/^[A-Za-z0-9_.-]+$/.test(username)) {
      throw new Error("Use only letters, numbers, dots, underscores, or dashes in usernames.");
    }
  }

  function cleanAmount(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a valid amount greater than 0.");
    return Math.round(value * 100) / 100;
  }

  function cleanDate(date) {
    const value = String(date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Select a valid date.");
    return value;
  }

  function requireAdminWrite() {
    if (!FINGS.auth || !FINGS.auth.isAdmin()) {
      throw new Error("Read-only access. Only admin can make changes.");
    }
  }

  async function init() {
    if (db) return db;
    assertFirebaseConfig();
    if (!firebase.apps.length) firebase.initializeApp(FINGS_FIREBASE_CONFIG);
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
  async function addTransaction({ type, description, amount, date }) {
    requireAdminWrite();
    if (!["sale", "purchase", "expense"].includes(type)) throw new Error("Invalid entry type.");
    await db.collection("transactions").add({
      type,
      description: String(description || "").trim(),
      amount: cleanAmount(amount),
      date: cleanDate(date),
      createdAt: Date.now()
    });
  }

  async function deleteTransaction(id) {
    requireAdminWrite();
    // cascade-delete linked payments so the bank balance stays accurate
    const linked = state.payments.filter(p => p.linkedTransactionId === id);
    const batch = db.batch();
    linked.forEach(p => batch.delete(db.collection("payments").doc(p.id)));
    batch.delete(db.collection("transactions").doc(id));
    await batch.commit();
  }

  // ---------- payments (in / out) ----------
  async function addPayment({ type, partyName, invoiceNo, date, amount, linkedTransactionId }) {
    requireAdminWrite();
    if (!["in", "out"].includes(type)) throw new Error("Invalid payment type.");
    await db.collection("payments").add({
      type, partyName: partyName || "", invoiceNo: invoiceNo || "",
      date: cleanDate(date),
      amount: cleanAmount(amount),
      linkedTransactionId: linkedTransactionId || null,
      createdAt: Date.now()
    });
  }

  async function deletePayment(id) {
    requireAdminWrite();
    await db.collection("payments").doc(id).delete();
  }

  // ---------- users ----------
  async function addUser({ username, password, name, role }) {
    requireAdminWrite();
    username = cleanUsername(username);
    assertValidUsername(username);
    if (!password || String(password).length < 4) throw new Error("Password must be at least 4 characters.");
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
    username = cleanUsername(username);
    if (!username) return null;
    const snap = await db.collection("users").doc(username).get();
    return snap.exists ? snap.data() : null;
  }

  // ---------- business config ----------
  async function saveBusinessConfig({ name, openingBalance, actualBalance }) {
    requireAdminWrite();
    const opening = Number(openingBalance || 0);
    const actual = Number(actualBalance || 0);
    if (!Number.isFinite(opening) || !Number.isFinite(actual)) throw new Error("Enter valid balance amounts.");
    const totals = computeTotals();
    const derivedBeforeAdjustment = opening + totals.paymentIn - totals.paymentOut - totals.expense;
    const manualAdjustment = actual - derivedBeforeAdjustment;
    await db.collection("config").doc("business").set({
      name: String(name || "").trim(),
      openingBalance: Math.round(opening * 100) / 100,
      manualAdjustment: Math.round(manualAdjustment * 100) / 100
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

  function paidAmountFor(transactionId) {
    return state.payments.filter(p => p.linkedTransactionId === transactionId)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
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
    computeTotals, actualBalance, paidAmountFor,
    entriesForDay, entriesForMonth,
    state
  };
})();
