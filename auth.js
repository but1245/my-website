// auth.js

import { auth } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* SIGNUP */
window.signup = function(){
  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;

  createUserWithEmailAndPassword(auth, email, password)
    .then(() => alert("Signup Success ✅"))
    .catch(err => alert(err.message));
};

/* LOGIN */
window.login = function(){
  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      alert("Login Success ✅");
      window.location.href="index.html";
    })
    .catch(err => alert(err.message));
};