import { db } from "./firebase.js";
import { 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Mapping steps to matching indices (1-indexed based on currentStep in admin-orders.js)
const STEPS_LABELS = [
    "Pending",
    "Confirmed",
    "Designing",
    "Material Selection",
    "In Production",
    "Finishing & QC",
    "Out for Delivery",
    "Delivered"
];

/* TRACK FUNCTION */
window.trackOrder = async function() {
    const mobile = document.getElementById("mobile").value.trim();
    const orderIdInput = document.getElementById("orderId").value.trim().toUpperCase();
    const captchaText = document.getElementById("captchaText").innerText.replace(/\s/g, "");
    const captchaInput = document.getElementById("captchaInput").value.trim();

    const statusBox = document.getElementById("statusBox");
    const previewBox = document.getElementById("previewBox");
    const orderImg = document.getElementById("orderImg");
    const trackBtn = document.querySelector(".track-btn");

    // 1. Basic Validation
    if (!mobile || !orderIdInput) {
        window.showToast("⚠️ Please enter both mobile number and order ID", "error");
        return;
    }

    if (captchaInput !== captchaText) {
        window.showToast("❌ Incorrect Captcha Code", "error");
        refreshCaptcha();
        return;
    }

    try {
        trackBtn.innerText = "Searching... 🔍";
        trackBtn.disabled = true;

        // 2. Query Firestore by Mobile
        // We filter by mobile first because it's indexed, then we find the ID match in JS
        const q = query(collection(db, "custom_orders"), where("customer.mobile", "==", mobile));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            window.showToast("❌ No orders found for this mobile number", "error");
            statusBox.style.display = "none";
            previewBox.style.display = "none";
            return;
        }

        let foundOrder = null;
        querySnapshot.forEach((doc) => {
            const id = doc.id.toUpperCase();
            // Check if the input ID matches the start of the Firestore ID
            if (id.startsWith(orderIdInput)) {
                foundOrder = { id: doc.id, ...doc.data() };
            }
        });

        if (!foundOrder) {
            window.showToast("❌ Order ID not found for this mobile number", "error");
            statusBox.style.display = "none";
            previewBox.style.display = "none";
            return;
        }

        // 3. Show Results
        window.showToast("Order Found! Showing status... ✨", "success");
        statusBox.style.display = "flex";
        previewBox.style.display = "block";

        // Set Image (if exists)
        if (foundOrder.imageUrl) {
            orderImg.src = foundOrder.imageUrl;
            orderImg.style.display = "block";
        } else {
            orderImg.src = "images/logo.png"; // Placeholder
        }

        // Update Steps
        const currentStep = foundOrder.currentStep || 1;
        const steps = document.querySelectorAll(".step");

        steps.forEach((step, i) => {
            if (i < currentStep) {
                step.classList.add("active");
            } else {
                step.classList.remove("active");
            }
        });

    } catch (error) {
        console.error("Tracking Error:", error);
        window.showToast("Error searching for order. Please try again.", "error");
    } finally {
        trackBtn.innerText = "Track Order →";
        trackBtn.disabled = false;
        refreshCaptcha();
    }
};

/* CAPTCHA REFRESH */
window.refreshCaptcha = function() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let cap = "";
    for (let i = 0; i < 5; i++) {
        cap += chars[Math.floor(Math.random() * chars.length)] + " ";
    }
    document.getElementById("captchaText").innerText = cap.trim();
};

// Initialize Captcha
document.addEventListener("DOMContentLoaded", () => {
    if (typeof refreshCaptcha === "function") refreshCaptcha();
});
