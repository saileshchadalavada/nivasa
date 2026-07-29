import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Config comes from .env (see .env.example). Never hard-code keys here.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Auto-detect long-polling so Firestore's realtime connection survives
// corporate proxies / VPNs / firewalls that close streaming connections
// (the usual cause of net::ERR_CONNECTION_CLOSED on the Write channel).
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

