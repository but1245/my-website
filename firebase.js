// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 🔥 YOUR CONFIG (firebase se copy karna)
const firebaseConfig = {
  apiKey: "AIzaSyDcaWYO7AygVGPQJDJAp-eovL42zewZ8y0",
  authDomain: "pradeep-furniture.firebaseapp.com",
  projectId: "pradeep-furniture",
  storageBucket: "pradeep-furniture.firebasestorage.app",
  messagingSenderId: "441570353263",
  appId: "1:441570353263:web:3204c5b4593d8938d36d9a"
};

// INIT
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// EXPORT
export { auth };