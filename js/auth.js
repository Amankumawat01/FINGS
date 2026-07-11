/* =========================================================
   FINGS — auth
   Custom username/password auth backed by Firestore (no
   Firebase Auth service, since accounts are admin-issued
   rather than self-registered). Passwords are SHA-256 hashed
   before being stored/compared — see README for the security
   trade-offs of a fully client-side login like this.
   ========================================================= */
window.FINGS = window.FINGS || {};

FINGS.auth = (function () {
  let currentUser = null; // { username, name, role }

  function restore() {
    const raw = sessionStorage.getItem("fings_session");
    if (raw) {
      try { currentUser = JSON.parse(raw); } catch (e) { currentUser = null; }
    }
    return currentUser;
  }

  function persist() {
    if (currentUser) sessionStorage.setItem("fings_session", JSON.stringify(currentUser));
    else sessionStorage.removeItem("fings_session");
  }

  async function login(username, password) {
    username = (username || "").trim();
    if (!username || !password) throw new Error("Enter a username and password.");

    const user = await FINGS.data.findUser(username);
    if (!user) throw new Error("No account with that username.");

    const hash = await FINGS.util.sha256(password);
    if (hash !== user.passwordHash) throw new Error("Incorrect password.");

    currentUser = { username: user.username, name: user.name || user.username, role: user.role || "staff" };
    persist();
    return currentUser;
  }

  function logout() {
    currentUser = null;
    persist();
  }

  function isAdmin() {
    return !!currentUser && currentUser.role === "admin";
  }

  function get() {
    return currentUser;
  }

  return { restore, login, logout, isAdmin, get };
})();
