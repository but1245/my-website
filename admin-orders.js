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

let allOrders = []; // Local cache for filtering

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            let role = docSnap.data().role;
            if (role === "admin") {
                document.getElementById("admin-name").innerText = "Owner Portal: " + docSnap.data().firstName;
                listenForOrders();
                return;
            }
        }
        window.showToast("Unauthorized Access! 🔒", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 2000);
    } else {
         window.location.href = "admin-login.html?redirect=admin-orders.html";
    }
});

function listenForOrders() {
    const q = query(collection(db, "custom_orders"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Update stats
        updateStats(allOrders);
        
        // Initial render
        applyFilters();
    });
}

function updateStats(orders) {
    let pending = 0, production = 0, delivered = 0;
    orders.forEach(order => {
        const status = order.status || "Pending";
        if (status === "Pending") pending++;
        if (status === "In Production") production++;
        if (status === "Delivered") delivered++;
    });

    document.getElementById("count-total").innerText = orders.length;
    document.getElementById("count-pending").innerText = pending;
    document.getElementById("count-production").innerText = production;
    document.getElementById("count-delivered").innerText = delivered;
}

function applyFilters() {
    const searchTerm = document.getElementById("orderSearch").value.toLowerCase();
    const statusFilter = document.getElementById("statusFilter").value;

    const filtered = allOrders.filter(order => {
        const matchesSearch = 
            order.customer.name.toLowerCase().includes(searchTerm) || 
            order.customer.mobile.includes(searchTerm) || 
            order.id.toLowerCase().includes(searchTerm);
        
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    renderOrders(filtered);
}

function renderOrders(orders) {
    const listEl = document.getElementById("all-orders-list");
    
    if (orders.length === 0) {
        listEl.innerHTML = `<div class="empty-state" style="text-align:center; padding:40px; color:var(--text-muted);">
            <i class="fa-solid fa-search-minus" style="font-size:30px; margin-bottom:10px;"></i>
            <p>No orders match your search criteria.</p>
        </div>`;
        return;
    }

    let html = "";
    orders.forEach((order) => {
        const id = order.id;
        const status = order.status || "Pending";
        
        let stepOptions = "";
        STEPS.forEach((step, index) => {
            const selected = status === step.label ? "selected" : "";
            stepOptions += `<option value="${index}" ${selected}>Step ${index + 1}: ${step.label}</option>`;
        });

        html += `
            <div class="order-card card" id="card-${id}">
                <div class="order-header">
                    <div class="order-info">
                        <h4>${order.furniture.type}</h4>
                        <p>Customer: <strong>${order.customer.name}</strong> (${order.customer.mobile})</p>
                        <span>ID: #${id.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <div class="order-status-badge status-${status.toLowerCase().replace(/\s+/g, "-")}">
                        ${status}
                    </div>
                </div>

                <div class="admin-controls" style="margin-top:15px; border-top:1px solid var(--border-color); padding-top:15px;">
                    <button class="details-btn" onclick="showOrderDetails('${id}')">
                        <i class="fa-solid fa-circle-info"></i> View Full Details
                    </button>
                    
                    <div style="flex-grow:1; display:flex; align-items:center; gap:10px; justify-content:flex-end;">
                        <select class="admin-select" id="select-${id}" style="max-width:200px;">
                            ${stepOptions}
                        </select>
                        <button class="update-btn" onclick="updateOrderStatus('${id}')">Update</button>
                    </div>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

// Filter listeners
document.getElementById("orderSearch").addEventListener("input", applyFilters);
document.getElementById("statusFilter").addEventListener("change", applyFilters);

// Update Status function
window.updateOrderStatus = async function(id) {
    const select = document.getElementById("select-" + id);
    const stepIndex = parseInt(select.value);
    const newStep = STEPS[stepIndex];
    const btn = select.nextElementSibling;
    const originalText = btn.innerText;

    // Ask for a custom note
    const customNote = prompt(`Add a note for this step (${newStep.label}):`, `Status updated to ${newStep.label}`);
    if (customNote === null) return; // User cancelled

    try {
        btn.innerText = "Wait...";
        btn.disabled = true;

        const orderRef = doc(db, "custom_orders", id);
        await updateDoc(orderRef, {
            status: newStep.label,
            currentStep: stepIndex + 1,
            progress: newStep.progress,
            statusHistory: arrayUnion({
                status: newStep.label,
                note: customNote,
                updatedAt: new Date().toISOString()
            })
        });

        window.showToast(`Updated to ${newStep.label}`, "success");
    } catch (error) {
        window.showToast("Error: " + error.message, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// Modal Logic
const modal = document.getElementById("detailsModal");
const closeModal = document.getElementById("closeModal");

window.showOrderDetails = function(id) {
    const order = allOrders.find(o => o.id === id);
    if (!order) return;

    const body = document.getElementById("modal-body");
    const dateStr = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : "N/A";

    body.innerHTML = `
        <div class="details-grid">
            <div class="detail-item">
                <label>Customer Name</label>
                <p>${order.customer.name}</p>
            </div>
            <div class="detail-item">
                <label>Mobile Number</label>
                <p>${order.customer.mobile}</p>
            </div>
            <div class="detail-item">
                <label>City</label>
                <p>${order.customer.city || "N/A"}</p>
            </div>
            <div class="detail-item">
                <label>Furniture Type</label>
                <p>${order.furniture.type}</p>
            </div>
            <div class="detail-item">
                <label>Dimensions (LxWxH)</label>
                <p>${order.furniture.dimensions.length} x ${order.furniture.dimensions.width} x ${order.furniture.dimensions.height} ${order.furniture.dimensions.unit}</p>
            </div>
            <div class="detail-item">
                <label>Material</label>
                <p>${order.preferences.material || "Standard"}</p>
            </div>
            <div class="detail-item">
                <label>Color Preference</label>
                <p>${order.preferences.color || "Default"}</p>
            </div>
            <div class="detail-item">
                <label>Polish/Finish</label>
                <p>${order.preferences.polish ? "Yes" : "No"}</p>
            </div>
            <div class="detail-item full-width">
                <label>Customization Details</label>
                <p>${order.preferences.details || "No special instructions provided."}</p>
            </div>
            <div class="detail-item full-width">
                <label>Reference Image</label>
                ${order.imageUrl ? 
                    `<img src="${order.imageUrl}" style="width:100%; border-radius:12px; margin-top:10px; border:1px solid var(--border-color);">` : 
                    `<p style="color:var(--text-muted); font-style:italic;">No image uploaded.</p>`
                }
            </div>
            <div class="detail-item full-width" style="border-top:1px dashed var(--border-color); padding-top:15px;">
                <label>Created At</label>
                <p>${dateStr}</p>
            </div>
        </div>
    `;

    modal.style.display = "flex";
};

closeModal.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; };
