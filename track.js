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
    const captchaInput = document.getElementById("captchaInput").value.trim().toUpperCase();

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

        // Clean the input mobile number (keep only last 10 digits for comparison)
        const cleanMobile = mobile.replace(/\D/g, "").slice(-10);

        // We fetch all orders and filter in JS to be flexible with phone formatting
        const q = query(collection(db, "custom_orders"));
        const querySnapshot = await getDocs(q);

        let foundOrder = null;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const dbMobile = (data.customer?.mobile || "").replace(/\D/g, "").slice(-10);
            const dbId = doc.id.toUpperCase();

            // Match both clean mobile and partial ID
            if (dbMobile === cleanMobile && dbId.includes(orderIdInput)) {
                foundOrder = { id: doc.id, ...data };
            }
        });

        if (!foundOrder) {
            window.showToast("❌ No matching order found. Check details!", "error");
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

        // Update Steps with Dates
        const currentStep = foundOrder.currentStep || 1;
        const steps = document.querySelectorAll(".step");
        const history = foundOrder.statusHistory || [];

        steps.forEach((stepEl, i) => {
            const stepLabel = STEPS_LABELS[i];
            
            // Find if this status exists in history
            const historyEntry = history.find(h => h.status === stepLabel);
            let dateStr = "";

            if (historyEntry && historyEntry.updatedAt) {
                const d = new Date(historyEntry.updatedAt);
                dateStr = d.toLocaleString('en-IN', { 
                    day: '2-digit', month: 'short', 
                    hour: '2-digit', minute: '2-digit', hour12: true 
                });
            } else if (i === 0 && foundOrder.createdAt) {
                const d = foundOrder.createdAt.toDate ? foundOrder.createdAt.toDate() : new Date(foundOrder.createdAt);
                dateStr = d.toLocaleString('en-IN', { 
                    day: '2-digit', month: 'short', 
                    hour: '2-digit', minute: '2-digit', hour12: true 
                });
            }

            // Update HTML with date if active
            const title = stepEl.innerText.split("\n")[0]; // Get the "1. Pending..." part
            if (i < currentStep) {
                stepEl.classList.add("active");
                stepEl.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span>${title}</span>
                        <span style="font-size: 11px; opacity: 0.7; font-weight: 400;">${dateStr}</span>
                    </div>
                `;
            } else {
                stepEl.classList.remove("active");
                stepEl.innerHTML = `<span>${title}</span>`;
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
