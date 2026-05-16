import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDlAE_Lfr_pdHUIt-Tfkfl3zv_xURnk-vE",
  authDomain: "gma-socios.firebaseapp.com",
  projectId: "gma-socios",
  storageBucket: "gma-socios.firebasestorage.app",
  messagingSenderId: "555627861244",
  appId: "1:555627861244:web:dedbda2af496e392acb379",
  measurementId: "G-5GR7411QZ6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth, analytics };
