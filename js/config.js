/* =========================================================
   FINGS — Firebase configuration
   =========================================================
   You gave us the project ID and project number, but a
   browser (Firebase Web SDK) needs the FULL web app config
   object, which also includes an apiKey, authDomain, etc.

   To get it:
     1. Firebase console → fing-b3cd9
     2. Project settings (gear icon) → General tab
     3. Scroll to "Your apps" → if none exists, click
        "</> Add app" → Web → register (any nickname)
     4. Copy the firebaseConfig object shown there and paste
        the values below.

   Until this is filled in, FINGS cannot connect and will
   show a connection error on the login screen.
   ========================================================= */

const FINGS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDgqR8AgLEfRXdvXikr80JaqoCdfD22F3I",
  authDomain: "fing-b3cd9.firebaseapp.com",
  projectId: "fing-b3cd9",
  storageBucket: "fing-b3cd9.appspot.com",
  messagingSenderId: "264674066589",
  appId: "1:264674066589:web:e19f5742456803c8e91474"
};

function FINGS_isFirebaseConfigComplete(config) {
  const required = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
  return required.every((key) => {
    const value = String((config || {})[key] || "").trim();
    return value && !value.includes("PASTE_YOUR_");
  });
}

/* Hardcoded super-admin credentials (also auto-seeded into the
   `users` collection on first run, hashed, so the admin shows up in
   Settings → Users like everyone else). To change the admin password
   later, edit it here AND delete the AGS_Admin document in Firestore
   so it re-seeds with the new one on next load. */
const FINGS_ADMIN_USERNAME = "AGS_Admin";
const FINGS_ADMIN_PASSWORD = "Ags@1982";
