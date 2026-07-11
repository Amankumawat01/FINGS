/* =========================================================
   FINGS — app bootstrap & router
   ========================================================= */
window.FINGS = window.FINGS || {};

FINGS.app = (function () {

  function showView(name) {
    document.querySelectorAll("#view-container .screen").forEach(s => {
      s.classList.remove("active");
      s.classList.add("hidden");
    });
    document.querySelectorAll(".bottom-nav .nav-btn").forEach(b => b.classList.remove("active"));
    const target = document.getElementById("view-" + name);
    if (!target) return;
    target.classList.remove("hidden");
    target.classList.add("active");
    const navBtn = document.querySelector(`.bottom-nav .nav-btn[data-view="${name}"]`);
    if (navBtn) navBtn.classList.add("active");
    if (name === "reports") FINGS.reports.render();
    if (name === "settings") FINGS.settings.render();
    if (name === "dashboard") FINGS.dashboard.render();
  }

  function closeSheet() {
    document.getElementById("sheet-overlay").classList.add("hidden");
    document.getElementById("bottom-sheet").classList.add("hidden");
    document.getElementById("sheet-body").innerHTML = "";
  }
  FINGS.closeSheet = closeSheet;

  function openAddMenu() {
    if (!FINGS.auth.isAdmin()) {
      FINGS.util.toast("Read-only access");
      return;
    }
    document.getElementById("add-menu-overlay").classList.remove("hidden");
    document.getElementById("add-menu").classList.remove("hidden");
  }
  function closeAddMenu() {
    document.getElementById("add-menu-overlay").classList.add("hidden");
    document.getElementById("add-menu").classList.add("hidden");
  }

  function renderAll() {
    const active = document.querySelector("#view-container .screen.active").id.replace("view-", "");
    if (active === "dashboard") FINGS.dashboard.render();
    if (active === "reports") FINGS.reports.render();
    if (active === "settings") FINGS.settings.render();
  }

  function enterApp(user) {
    const isAdmin = user.role === "admin";
    document.getElementById("view-login").classList.remove("active");
    const shell = document.getElementById("app-shell");
    shell.classList.remove("hidden");
    shell.classList.toggle("readonly-mode", !isAdmin);
    document.getElementById("fab-add").classList.toggle("hidden", !isAdmin);
    document.getElementById("topbar-username").textContent = `${user.name} · ${isAdmin ? "Admin" : "Staff"}`;
    showView("dashboard");
  }

  function logout() {
    FINGS.auth.logout();
    FINGS.data.teardown();
    document.getElementById("app-shell").classList.add("hidden");
    document.getElementById("view-login").classList.add("active");
    document.getElementById("login-username").value = "";
    document.getElementById("login-password").value = "";
  }

  function bindStaticEvents() {
    // login
    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("login-error");
      const submitBtn = document.getElementById("login-submit");
      errEl.classList.add("hidden");
      submitBtn.disabled = true;
      submitBtn.querySelector(".btn-label").classList.add("hidden");
      submitBtn.querySelector(".spinner").classList.remove("hidden");
      try {
        const user = await FINGS.auth.login(
          document.getElementById("login-username").value,
          document.getElementById("login-password").value
        );
        FINGS.data.subscribeAll(renderAll);
        enterApp(user);
      } catch (err) {
        errEl.textContent = err.message || "Could not log in.";
        errEl.classList.remove("hidden");
      } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector(".btn-label").classList.remove("hidden");
        submitBtn.querySelector(".spinner").classList.add("hidden");
      }
    });

    // bottom nav
    document.querySelectorAll(".bottom-nav .nav-btn").forEach(btn => {
      btn.addEventListener("click", () => showView(btn.dataset.view));
    });

    // logout
    document.getElementById("logout-btn").addEventListener("click", logout);

    // FAB + add menu
    document.getElementById("fab-add").addEventListener("click", openAddMenu);
    document.getElementById("add-menu-overlay").addEventListener("click", closeAddMenu);
    document.querySelectorAll("#add-menu .add-menu-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.type;
        closeAddMenu();
        if (type !== "cancel") FINGS.dashboard.openAddForm(type);
      });
    });

    // sheet close
    document.getElementById("sheet-overlay").addEventListener("click", closeSheet);

    FINGS.dashboard.bindEvents();
    FINGS.reports.bindEvents();
    FINGS.settings.bindEvents();
  }

  async function boot() {
    bindStaticEvents();
    try {
      await FINGS.data.init();
      await FINGS.data.ensureSeedAdmin();
    } catch (err) {
      console.error(err);
      const errEl = document.getElementById("login-error");
      errEl.textContent = err.message || "Could not connect to Firebase. Check your internet connection and js/config.js.";
      errEl.classList.remove("hidden");
      return; // stop here; db isn't ready, so don't try to restore a session or load data
    }

    const session = FINGS.auth.restore();
    if (session) {
      FINGS.data.subscribeAll(renderAll);
      enterApp(session);
    }
  }

  return { boot, logout, showView };
})();

document.addEventListener("DOMContentLoaded", FINGS.app.boot);
