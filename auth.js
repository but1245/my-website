// auth.js
import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Helper to get redirection URL
const getRedirectUrl = () => {
  const url = localStorage.getItem("authRedirect");
  return url || "index.html";
};

// Record current page as redirect target if not auth page
if (!window.location.pathname.includes("login.html") && !window.location.pathname.includes("signup.html")) {
    localStorage.setItem("authRedirect", window.location.href);
}

/* SIGNUP FUNCTION */
window.signup = async function() {
  const firstName = document.getElementById("firstname").value;
  const lastName = document.getElementById("lastname").value;
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if(!email || !password || !firstName || !username) {
    window.showToast("Please fill all required fields!", "error");
    return;
  }

  try {
    // 1. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Save additional details in Firestore
    await setDoc(doc(db, "users", user.uid), {
      firstName: firstName,
      lastName: lastName,
      username: username,
      email: email,
      createdAt: new Date().toISOString()
    });

    window.showToast("Account Created Successfully! 🎉", "success");
    
    // Redirect back to where the user was before
    setTimeout(() => {
        window.location.href = getRedirectUrl();
    }, 1500);

  } catch (error) {
    window.showToast("Signup Error: " + error.message, "error");
  }
};

/* LOGIN FUNCTION */
window.login = async function() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  if(!email || !password) {
    window.showToast("Please enter email and password!", "error");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.showToast("Login Success! Welcome back 👋", "success");
    
    setTimeout(() => {
        window.location.href = getRedirectUrl();
    }, 1500);
  } catch (error) {
    window.showToast("Login Error: " + error.message, "error");
  }
};

/* LOGOUT FUNCTION */
window.logout = async function() {
  try {
    await signOut(auth);
    window.showToast("Logged Out Successfully!", "success");
    setTimeout(() => {
        window.location.reload();
    }, 1000);
  } catch (error) {
    console.error("Logout Error", error);
  }
};

/* MONITOR AUTH STATE */
onAuthStateChanged(auth, async (user) => {
  const userDisplay = document.getElementById("user-name");
  const authBtn = document.querySelector(".auth-btn");

  if (user) {
    // User is signed in, fetch details from Firestore
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const userData = docSnap.data();
      if (userDisplay) userDisplay.innerText = "Hi, " + userData.firstName;
      if (authBtn) {
        authBtn.innerText = "Logout";
        authBtn.onclick = window.logout;
        const parentA = authBtn.closest('a');
        if (parentA) parentA.href = "javascript:void(0)";
      }
    }
  } else {
    // User is signed out
    if (userDisplay) userDisplay.innerText = "";
    if (authBtn) {
      authBtn.innerText = "Login / Signup";
      const parentA = authBtn.closest('a');
      if (parentA) parentA.href = "login.html";
    }
  }
});