import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAmp5yNQY2s_w0FVIoa5Hw3zjIXGgFhefM",
  authDomain: "sri-nirvana-plaza.firebaseapp.com",
  projectId: "sri-nirvana-plaza",
  storageBucket: "sri-nirvana-plaza.firebasestorage.app",
  messagingSenderId: "8831156962",
  appId: "1:8831156962:web:a2fc65074dc087273154bb",
  measurementId: "G-W79JF025PQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
