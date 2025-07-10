// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyCFkBd5Iw4gOkfamvdSnsQrpe1Ut3TKCF8",
  authDomain: "webrdp-779cb.firebaseapp.com",
  projectId: "webrdp-779cb",
  storageBucket: "webrdp-779cb.appspot.com",
  messagingSenderId: "633572180200",
  appId: "1:633572180200:web:dbac22ecb4f7a8baa9895d"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);       // Firestore Database
