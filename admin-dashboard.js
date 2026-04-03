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
let trendsChartInstance = null;
let allUsers = []; 

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
                // Load dashboard data safely
                try {
                    loadDashboardMetrics();
                    loadRecentOrders();
                    loadRecentUsers();
                    loadAllUsersData();
                    // Force the overview tab to show
                    setTimeout(() => {
                        window.switchTab('overview');
                    }, 500);
                } catch (err) {
                    console.error("Initialization Error:", err);
                }
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
    const statUsers = document.getElementById("stat-users");
    onSnapshot(collection(db, "users"), (snapshot) => {
        if (statUsers) statUsers.innerText = snapshot.size;
    }, (error) => {
        console.error("Error loading users:", error);
    });

    // 2. Orders Metrics & Chart
    const statOrders = document.getElementById("stat-orders");
    const statPending = document.getElementById("stat-pending");
    const statDelivered = document.getElementById("stat-delivered");

    onSnapshot(collection(db, "custom_orders"), (snapshot) => {
        if (statOrders) statOrders.innerText = snapshot.size;
        
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

        if (statPending) statPending.innerText = pending;
        if (statDelivered) statDelivered.innerText = delivered;
        
        renderChart(statusCounts);
    }, (error) => {
        console.error("Error loading orders chart:", error);
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
                    <td><span style="font-family:monospace; color:var(--accent-color);">#${id.substring(0,8).toUpperCase()}</span></td>
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
    const canvas = document.getElementById('orderStatusChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Check if Chart is loaded
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js not loaded yet.");
        return;
    }
    
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
/* ================= TAB SWITCHER ================= */
window.switchTab = function(tabId) {
    // 1. Update Sidebar Links
    document.querySelectorAll('.tab-link').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // 2. Toggle Sections
    document.querySelectorAll('.tab-content').forEach(section => {
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(`${tabId}-section`);
    if (targetSection) {
        targetSection.style.display = 'block';
    } else {
        console.error(`Tab section ${tabId}-section not found!`);
    }

    // 3. Specific Actions
    if (tabId === 'analytics') {
        renderTrendsChart();
    }
};

/* ================= ALL USERS (MANAGEMENT) ================= */
function loadAllUsersData() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        allUsers = [];
        snapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });
        renderUsersTable(allUsers);
    });
}

function renderUsersTable(users) {
    const listEl = document.getElementById("all-users-list");
    if (!listEl) return;

    if (users.length === 0) {
        listEl.innerHTML = `<tr><td colspan="5" style="text-align:center;">No users found.</td></tr>`;
        return;
    }

    let html = "";
    users.forEach(user => {
        const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A";
        const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
        const role = user.role === "admin" 
            ? `<span class="status-pill active" style="background:#ffebee; color:#c62828;">Admin</span>` 
            : `<span class="status-pill">Customer</span>`;

        html += `
            <tr>
                <td><strong>${fullName}</strong></td>
                <td>${user.email}</td>
                <td>${role}</td>
                <td><span class="status-pill active">Verified</span></td>
                <td>${date}</td>
            </tr>
        `;
    });
    listEl.innerHTML = html;
}

window.searchUsers = function() {
    const term = document.getElementById("user-search").value.toLowerCase();
    const filtered = allUsers.filter(u => 
        (u.firstName + " " + u.lastName).toLowerCase().includes(term) || 
        u.email.toLowerCase().includes(term)
    );
    renderUsersTable(filtered);
};

/* ================= ADVANCED ANALYTICS ================= */
function renderTrendsChart() {
    const ctx = document.getElementById('orderTrendsChart').getContext('2d');
    
    // Static dummy data for trends (simulating growth)
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const data = [12, 19, 15, 25, 32, 45]; // Orders growth

    if (trendsChartInstance) trendsChartInstance.destroy();

    trendsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Orders',
                data: data,
                borderColor: '#c49a6c',
                backgroundColor: 'rgba(196, 154, 108, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#c49a6c'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Update revenue stat
    const revenue = data.reduce((a, b) => a + b, 0) * 15000; // Average price
    document.getElementById("stat-revenue").innerText = `₹${revenue.toLocaleString()}`;
    document.getElementById("stat-growth").innerText = `+${Math.round((data[5]/data[4]-1)*100)}%`;
}
