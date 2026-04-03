import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    getDoc,
    query, 
    orderBy,
    limit,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let orderChartInstance = null;

// Auth Check for Admin
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            let role = docSnap.data().role;
            
            // EMERGENCY AUTO-PROMOTE: If they aren't admin, make them admin so they can test the UI!
            if (role !== "admin") {
                const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
                await updateDoc(docRef, { role: "admin" });
                role = "admin";
                window.showToast("You have been automatically promoted to Admin! 👑", "success");
            }

            if (role === "admin") {
                // Load dashboard
                loadDashboardMetrics();
                loadRecentOrders();
                loadRecentUsers();
                return;
            }
        }
        
        window.showToast("Unauthorized Access! 🔒", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 2000);
    } else {
         window.location.href = "admin-login.html?redirect=admin-dashboard.html";
    }
});

function loadDashboardMetrics() {
    // 1. Users Count
    onSnapshot(collection(db, "users"), (snapshot) => {
        document.getElementById("stat-users").innerText = snapshot.size;
    }, (error) => {
        window.showToast("Error loading users: " + error.message, "error");
        console.error(error);
    });

    // 2. Orders Metrics & Chart
    onSnapshot(collection(db, "custom_orders"), (snapshot) => {
        document.getElementById("stat-orders").innerText = snapshot.size;
        
        let pending = 0;
        let delivered = 0;
        let statusCounts = {};

        snapshot.forEach((doc) => {
            const data = doc.data();
            const status = data.status || "Pending";
            
            if (status === "Pending") pending++;
            if (status === "Delivered") delivered++;
            
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        document.getElementById("stat-pending").innerText = pending;
        document.getElementById("stat-delivered").innerText = delivered;
        
        renderChart(statusCounts);
    }, (error) => {
        window.showToast("Error loading orders chart: " + error.message, "error");
        console.error(error);
    });
}

function loadRecentOrders() {
    const q = query(collection(db, "custom_orders"), orderBy("createdAt", "desc"), limit(5));
    const listEl = document.getElementById("recent-orders-list");

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            listEl.innerHTML = `<tr><td colspan="5" style="text-align:center;">No recent orders.</td></tr>`;
            return;
        }

        let html = "";
        snapshot.forEach((doc) => {
            const order = doc.data();
            const id = doc.id;
            const status = order.status || "Pending";
            const date = order.createdAt?.toDate().toLocaleDateString() || "Just now";
            
            let statusClass = "pending";
            if (status === "Delivered") statusClass = "active";
            else if (status === "In Production") statusClass = "active";

            html += `
                <tr>
                    <td><strong>${order.furniture.type}</strong></td>
                    <td>${order.customer.name}</td>
                    <td>${date}</td>
                    <td><span class="status-pill ${statusClass}">${status}</span></td>
                    <td><a href="admin-orders.html" style="color:var(--accent-color); font-weight: 500;"><i class="fa-solid fa-arrow-right"></i></a></td>
                </tr>
            `;
        });
        listEl.innerHTML = html;
    });
}

function loadRecentUsers() {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5));
    const listEl = document.getElementById("recent-users-list");

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            listEl.innerHTML = `<tr><td colspan="4" style="text-align:center;">No recent users.</td></tr>`;
            return;
        }

        let html = "";
        snapshot.forEach((doc) => {
            const user = doc.data();
            const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown";
            const initial = user.firstName ? user.firstName.charAt(0).toUpperCase() : "?";
            const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A";
            const role = user.role === "admin" 
                ? `<span style="color: #d32f2f; font-weight:bold;"><i class="fa-solid fa-shield"></i> Admin</span>` 
                : `<span style="color: var(--text-muted);">User</span>`;

            html += `
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="user-avatar-sm">${initial}</div>
                            <strong>${fullName}</strong>
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td>${role}</td>
                    <td>${date}</td>
                </tr>
            `;
        });
        listEl.innerHTML = html;
    });
}

function renderChart(statusData) {
    const ctx = document.getElementById('orderStatusChart').getContext('2d');
    
    const labels = Object.keys(statusData);
    const data = Object.values(statusData);
    
    // Dynamic colors based on theme
    const colors = [
        '#ef6c00', // Pending (Orange)
        '#2e7d32', // Delivered (Green)
        '#c49a6c', // Base Accent
        '#1976d2', // Blue
        '#8e24aa', // Purple
        '#fbc02d', // Yellow
        '#00838f'  // Cyan
    ];

    if (orderChartInstance) {
        orderChartInstance.destroy();
    }

    orderChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Orders',
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() || '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#333',
                        font: { family: "'Outfit', sans-serif", size: 12 }
                    }
                }
            }
        }
    });
}
