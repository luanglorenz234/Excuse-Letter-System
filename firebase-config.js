/**
 * Alpha Premier — OJT Absence Request System (Final v1.0)
 * Firebase Configuration & Data Layer Adapter
 *
 * By default, the system runs in Local Firestore Sandbox Mode (persisted in localStorage)
 * so all 8 screens, transactions, duplicate slot guards, reference counters, and signatures
 * can be tested immediately. Set `USE_LIVE_FIREBASE = true` and populate `FIREBASE_CONFIG`
 * to connect to your live Firebase project.
 */

window.APG_FIREBASE_CONFIG = {
  useLiveFirebase: false,
  // Local testing only: shows the persona switcher bar at the top (or add ?demo=1 to the URL)
  showDemoBar: false,
  config: {
    apiKey: "YOUR_API_KEY",
    authDomain: "alpha-premier-ojt.firebaseapp.com",
    projectId: "alpha-premier-ojt",
    storageBucket: "alpha-premier-ojt.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000"
  }
};
