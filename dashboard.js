import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Dashboard: User authenticated", user.uid);
        await loadUserData(user.uid);
        await updateWishlistCount();
    } else {
        // Not logged in, redirect to login
        console.log("Dashboard: No user found, redirecting...");
        window.location.href = "login.html";
    }
});

// Load User Data
async function loadUserData(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Sidebar info
            document.getElementById("sidebar-name").innerText = `${data.firstName} ${data.lastName}`;
            document.getElementById("sidebar-avatar").innerText = data.firstName.charAt(0);
            
            // Overview tab
            document.getElementById("dash-name").innerText = data.firstName;
            document.getElementById("info-fullname").innerText = `${data.firstName} ${data.lastName}`;
            document.getElementById("info-email").innerText = data.email;
            document.getElementById("info-since").innerText = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "N/A";
            
            // Settings tab
            document.getElementById("settings-firstname").value = data.firstName;
            document.getElementById("settings-lastname").value = data.lastName;
            
        } else {
            console.error("No such user document!");
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    }
}

// Update Wishlist Count Summary
async function updateWishlistCount() {
    // This can be synced with localStorage or a separate Firestore collection
    const wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
    const countEl = document.getElementById("dash-wishlist-count");
    if (countEl) countEl.innerText = wishlist.length;
}

// Handle Settings Update
const settingsForm = document.getElementById("settings-form");
if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const firstName = document.getElementById("settings-firstname").value;
        const lastName = document.getElementById("settings-lastname").value;

        try {
            const docRef = doc(db, "users", user.uid);
            await updateDoc(docRef, {
                firstName: firstName,
                lastName: lastName
            });
            
            window.showToast("Profile Updated Successfully! ✨", "success");
            // Refresh sidebar/header
            document.getElementById("sidebar-name").innerText = `${firstName} ${lastName}`;
            document.getElementById("dash-name").innerText = firstName;
        } catch (error) {
            console.error("Update Error:", error);
            window.showToast("Update Failed: " + error.message, "error");
        }
    });
}

// Globally expose logout for the dashboard button
window.logout = async function() {
    try {
        await signOut(auth);
        window.showToast("Logged out successfully!", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1000);
    } catch (error) {
        console.error("Logout Error", error);
    }
};
