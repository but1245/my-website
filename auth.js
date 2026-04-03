// auth.js
import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  signOut,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc,
  query,
  where,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* USERNAME CHECK HELPER */
window.checkUsernameAvailability = async function(username) {
  if (!username) return true;
  try {
    const q = query(collection(db, "users"), where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty; // Returns true if available
  } catch (error) {
    console.error("Username check error:", error);
    return true;
  }
};
import { 
  googleProvider, 
  githubProvider, 
  facebookProvider 
} from "./firebase.js";

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

  if(password.length < 8) {
    window.showToast("Password must be at least 8 characters long! 🔒", "error");
    return;
  }

  try {
    // 1. Check if username is already taken
    const isAvailable = await window.checkUsernameAvailability(username);
    if (!isAvailable) {
      window.showToast("Username is already taken! ❌", "error");
      return;
    }

    // 2. Create user in Firebase Auth
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

/* SOCIAL LOGIN FUNCTIONS */
const handleSocialLogin = async (provider) => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user already exists in Firestore
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // If new social user, save basic profile safely
      const name = user.displayName || "New User";
      const email = user.email || `user${Math.floor(Math.random() * 1000)}@social.com`;
      const nameParts = name.split(" ");

      await setDoc(docRef, {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" "),
        username: email.split("@")[0] + Math.floor(Math.random() * 1000),
        email: email,
        createdAt: new Date().toISOString(),
        isSocial: true
      });
    }

    window.showToast(`Logged in successfully as ${user.displayName}! 👋`, "success");

    setTimeout(() => {
      window.location.href = getRedirectUrl();
    }, 1500);

  } catch (error) {
    console.error("Social Auth Error:", error);
    window.showToast(`Login Failed: ${error.message}`, "error");
  }
};

window.googleLogin = () => handleSocialLogin(googleProvider);
window.githubLogin = () => handleSocialLogin(githubProvider);
window.facebookLogin = () => handleSocialLogin(facebookProvider);

/* MONITOR AUTH STATE */
onAuthStateChanged(auth, async (user) => {
  const userDisplay = document.getElementById("user-name");
  const authBtn = document.querySelector(".auth-btn");
  const parentA = authBtn ? authBtn.closest('a') : null;

  if (user) {
    // User is signed in
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const userData = docSnap.data();
      if (userDisplay) {
        userDisplay.innerHTML = `<a href="dashboard.html" class="user-profile-link" style="display:inline-block;">Hi, ${userData.firstName}</a>`;
        userDisplay.style.display = "inline-block";
      }
      if (authBtn) {
        authBtn.style.display = "none"; 
      }
    }
  } else {
    // User is signed out
    if (userDisplay) {
        userDisplay.innerHTML = "";
        userDisplay.style.display = "none";
    }
    if (authBtn) {
      authBtn.style.display = "inline-block"; 
      authBtn.innerText = "Login / Signup";
      if (parentA) parentA.href = "login.html";
    }
  }
  
  // Show the nav-right section once auth state is determined to prevent flicker
  const navRight = document.querySelector(".nav-right");
  if (navRight) navRight.style.opacity = "1";
});