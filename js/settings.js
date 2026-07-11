/* =========================================================
   FINGS — settings view (profile + users)
   ========================================================= */
window.FINGS = window.FINGS || {};

FINGS.settings = (function () {

  function renderProfile() {
    const biz = FINGS.data.state.business;
    const focusedId = document.activeElement && document.activeElement.id;
    const isEditingProfile = ["profile-name", "profile-opening", "profile-actual"].includes(focusedId);

    // Don't overwrite fields the admin is actively typing into — a live
    // Firestore update elsewhere shouldn't wipe out an in-progress edit.
    if (!isEditingProfile) {
      document.getElementById("profile-name").value = biz.name || "";
      document.getElementById("profile-opening").value = biz.openingBalance || 0;
      document.getElementById("profile-actual").value = Number(FINGS.data.actualBalance().toFixed(2));
    }

    const admin = FINGS.auth.isAdmin();
    ["profile-name", "profile-opening", "profile-actual"].forEach(id => {
      document.getElementById(id).disabled = !admin;
    });
    document.getElementById("profile-save-btn").classList.toggle("hidden", !admin);
    document.getElementById("profile-readonly-note").classList.toggle("hidden", admin);
  }

  function roleBadge(role) {
    return `<span class="role-badge ${role === "admin" ? "admin" : "staff"}">${role === "admin" ? "Admin" : "Staff"}</span>`;
  }

  function renderUsers() {
    const list = document.getElementById("user-list");
    const users = FINGS.data.state.users.slice().sort((a, b) => (a.username > b.username ? 1 : -1));
    list.innerHTML = users.length ? users.map(u => `
      <div class="tx-row">
        <div class="tx-icon" style="background:var(--panel-slate-light);color:var(--paper-mist)">${(u.name || u.username).charAt(0).toUpperCase()}</div>
        <div class="tx-main">
          <div class="tx-title">${FINGS.util.escapeHtml(u.name || u.username)}</div>
          <div class="tx-sub"><span>@${FINGS.util.escapeHtml(u.username)}</span></div>
        </div>
        ${roleBadge(u.role)}
      </div>`).join("") : `<p class="empty-state">No users yet.</p>`;

    document.getElementById("add-user-btn").classList.toggle("hidden", !FINGS.auth.isAdmin());
  }

  function render() {
    renderProfile();
    renderUsers();
  }

  function addUserFormHtml() {
    return `
      <h3 style="margin:0 0 14px;font-family:var(--font-display)">Add user</h3>
      <form id="user-form">
        <label class="field"><span>Full name</span>
          <input type="text" id="u-name" placeholder="Display name" required></label>
        <label class="field"><span>Username</span>
          <input type="text" id="u-username" placeholder="e.g. ravi_k" required maxlength="40" pattern="[A-Za-z0-9_.-]+"></label>
        <label class="field"><span>Password</span>
          <input type="password" id="u-password" placeholder="Temporary password" required minlength="4"></label>
        <label class="field"><span>Role</span>
          <select id="u-role">
            <option value="staff" selected>Staff (read-only access)</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" class="btn btn-primary btn-block" style="margin-top:6px">Create user</button>
      </form>`;
  }

  function openAddUser() {
    document.getElementById("sheet-body").innerHTML = addUserFormHtml();
    document.getElementById("sheet-overlay").classList.remove("hidden");
    document.getElementById("bottom-sheet").classList.remove("hidden");
    document.getElementById("user-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await FINGS.data.addUser({
          name: document.getElementById("u-name").value.trim(),
          username: document.getElementById("u-username").value.trim(),
          password: document.getElementById("u-password").value,
          role: document.getElementById("u-role").value
        });
        FINGS.util.toast("User created");
        FINGS.closeSheet();
      } catch (err) {
        FINGS.util.toast(err.message || "Could not create user.");
        btn.disabled = false;
      }
    });
  }

  function bindEvents() {
    document.querySelectorAll("#settings-tabs .segmented-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#settings-tabs .segmented-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        document.getElementById("settings-profile").classList.toggle("hidden", tab !== "profile");
        document.getElementById("settings-users").classList.toggle("hidden", tab !== "users");
      });
    });

    document.getElementById("profile-save-btn").addEventListener("click", async () => {
      const btn = document.getElementById("profile-save-btn");
      btn.disabled = true;
      try {
        await FINGS.data.saveBusinessConfig({
          name: document.getElementById("profile-name").value.trim(),
          openingBalance: document.getElementById("profile-opening").value,
          actualBalance: document.getElementById("profile-actual").value
        });
        FINGS.util.toast("Profile updated");
      } catch (err) {
        FINGS.util.toast("Could not save changes.");
      }
      btn.disabled = false;
    });

    document.getElementById("add-user-btn").addEventListener("click", openAddUser);

    const doLogout = () => FINGS.app.logout();
    document.getElementById("settings-logout-btn").addEventListener("click", doLogout);
  }

  return { render, bindEvents };
})();
