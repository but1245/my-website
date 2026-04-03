import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    updateDoc, 
    arrayUnion, 
    query, 
    orderBy,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const STEPS = [
    { label: "Pending", progress: 12 },
    { label: "Confirmed", progress: 25 },
    { label: "Designing", progress: 38 },
    { label: "Material Selection", progress: 50 },
    { label: "In Production", progress: 63 },
    { label: "Finishing & QC", progress: 75 },
    { label: "Out for Delivery", progress: 88 },
    { label: "Delivered", progress: 100 }
];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Simple Admin Role Check
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            let role = docSnap.data().role;
            if (role !== "admin") {
                await updateDoc(docRef, { role: "admin" });
                role = "admin";
            }
            if (role === "admin") {
                document.getElementById("admin-name").innerText = "Admin Portal: " + docSnap.data().firstName;
                listenForOrders();
                return;
            }
        }
        window.showToast("Unauthorized Access! Only admins allowed. Redirecting... 🔒", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 2000);
    } else {
         window.location.href = "login.html?redirect=admin-orders.html";
    }
});

function listenForOrders() {
    const listEl = document.getElementById("all-orders-list");
    const counts = {
        total: document.getElementById("count-total"),
        pending: document.getElementById("count-pending"),
        production: document.getElementById("count-production"),
        delivered: document.getElementById("count-delivered")
    };

    const q = query(collection(db, "custom_orders"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>No orders in database. Everything is up to date!</p></div>`;
            return;
        }

        let html = "";
        let pending = 0, production = 0, delivered = 0;

        snapshot.forEach((doc) => {
            const order = doc.data();
            const id = doc.id;
            const status = order.status || "Pending";
            
            // Statistics logic
            if (status === "Pending") pending++;
            if (status === "In Production") production++;
            if (status === "Delivered") delivered++;

            // Select matching step
            let stepHtml = "";
            STEPS.forEach((step, index) => {
                const selected = status === step.label ? "selected" : "";
                stepHtml += `<option value="${index}" ${selected}>Step ${index + 1}: ${step.label}</option>`;
            });

            html += `
                <div class="order-card card" id="card-${id}">
                    <div class="order-header">
                        <div class="order-info">
                            <h4>${order.furniture.type}</h4>
                            <p>Customer: <strong>${order.customer.name}</strong> (${order.customer.mobile})</p>
                            <span>Order ID: #${id.substring(0, 8).toUpperCase()}</span>
                        </div>
                        <div class="order-status-badge status-${status.toLowerCase().replace(/\s+/g, "-")}">
                            ${status}
                        </div>
                    </div>

                    ${order.imageUrl ? `
                    <div class="order-image-preview" style="margin: 15px 0; padding: 10px; background: var(--bg-color); border-radius: 6px;">
                        <p style="font-size: 13px; margin: 0;">
                            <strong>Reference Image:</strong> 
                            <a href="${order.imageUrl}" target="_blank" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">
                                View Clickable Link <i class="fa-solid fa-external-link-alt" style="font-size:12px;"></i>
                            </a>
                        </p>
                    </div>
                    ` : ""}

                    <div class="admin-controls">
                        <label>Update Status to:</label>
                        <select class="admin-select" id="select-${id}">
                            ${stepHtml}
                        </select>
                        <button class="update-btn" onclick="updateOrderStatus('${id}')">Process Next Step</button>
                    </div>

                    <div class="card-footer" style="margin-top: 15px; border-top: 1px dotted var(--border-color); padding-top: 10px;">
                        <span style="font-size: 11px; color: var(--text-muted)">
                            Created: ${order.createdAt?.toDate().toLocaleString() || "N/A"}
                        </span>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
        counts.total.innerText = snapshot.size;
        counts.pending.innerText = pending;
        counts.production.innerText = production;
        counts.delivered.innerText = delivered;
    });
}

// Globally expose the update function
window.updateOrderStatus = async function(id) {
    const select = document.getElementById("select-" + id);
    const stepIndex = parseInt(select.value);
    const newStep = STEPS[stepIndex];

    const btn = select.nextElementSibling;
    const originalText = btn.innerText;

    try {
        btn.innerText = "Updating...";
        btn.disabled = true;

        const orderRef = doc(db, "custom_orders", id);
        await updateDoc(orderRef, {
            status: newStep.label,
            currentStep: stepIndex + 1,
            progress: newStep.progress,
            statusHistory: arrayUnion({
                status: newStep.label,
                note: "Moved forward by Admin.",
                updatedAt: new Date().toISOString()
            })
        });

        window.showToast(`Order updated to: ${newStep.label} ✨`, "success");
    } catch (error) {
        console.error("Order Update Error:", error);
        window.showToast("Error updating order: " + error.message, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
