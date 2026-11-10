/**
 * Alpha Premier — OJT Absence Request System (Production v1.0)
 * Firebase SDK Loader & Connection Manager
 *
 * Supports live Firebase (Auth + Cloud Firestore + Storage) using the official
 * Firebase v10 Modular SDK, with automatic Local Firestore Engine persistence
 * until live Firebase project keys are saved in `firebase-config.js` or via the
 * System Configuration dialog.
 */

const FB_CONFIG_STORAGE_KEY = "APG_FIREBASE_LIVE_CONFIG";

export function getSavedFirebaseConfig() {
  try {
    const saved = localStorage.getItem(FB_CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && parsed.apiKey !== "YOUR_API_KEY") {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error reading saved Firebase config:", e);
  }

  if (
    window.APG_FIREBASE_CONFIG &&
    window.APG_FIREBASE_CONFIG.useLiveFirebase &&
    window.APG_FIREBASE_CONFIG.config &&
    window.APG_FIREBASE_CONFIG.config.apiKey !== "YOUR_API_KEY"
  ) {
    return window.APG_FIREBASE_CONFIG.config;
  }

  return null;
}

export function saveFirebaseConfigToLocal(configObj) {
  localStorage.setItem(FB_CONFIG_STORAGE_KEY, JSON.stringify(configObj));
}

export function clearFirebaseConfigFromLocal() {
  localStorage.removeItem(FB_CONFIG_STORAGE_KEY);
}

let firebaseInstances = null;

export async function initFirebaseConnection() {
  const cfg = getSavedFirebaseConfig();
  if (!cfg) {
    return { mode: "local-firestore", app: null, auth: null, db: null };
  }

  try {
    const [
      { initializeApp },
      { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged },
      {
        getFirestore,
        collection,
        doc,
        getDoc,
        getDocs,
        setDoc,
        updateDoc,
        deleteDoc,
        query,
        where,
        orderBy,
        runTransaction
      }
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
    ]);

    const app = initializeApp(cfg);
    const auth = getAuth(app);
    const db = getFirestore(app);

    firebaseInstances = {
      mode: "live-firebase",
      app,
      auth,
      db,
      sdk: {
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        signOut,
        onAuthStateChanged,
        collection,
        doc,
        getDoc,
        getDocs,
        setDoc,
        updateDoc,
        deleteDoc,
        query,
        where,
        orderBy,
        runTransaction
      }
    };
    return firebaseInstances;
  } catch (err) {
    console.error("Failed to initialize live Firebase SDK, falling back to Local Firestore Engine:", err);
    return { mode: "local-firestore", app: null, auth: null, db: null, error: err.message };
  }
}
