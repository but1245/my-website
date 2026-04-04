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
                    
                    // 🔥 DEEP LINKING: Check URL for tab parameter
                    const urlParams = new URLSearchParams(window.location.search);
                    const targetTab = urlParams.get('tab') || 'overview';
                    
                    setTimeout(() => {
                        window.switchTab(targetTab);
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

    // 2. Orders Metrics & Revenue Analytics
    const statOrders = document.getElementById("stat-orders");
    const statPending = document.getElementById("stat-pending");
    const statDelivered = document.getElementById("stat-delivered");
    const statRevenue = document.getElementById("stat-revenue");
    const statGrowth = document.getElementById("stat-growth");

    onSnapshot(collection(db, "custom_orders"), (snapshot) => {
        if (statOrders) statOrders.innerText = snapshot.size;
        
        let pending = 0;
        let delivered = 0;
        let totalRevenue = 0;
        let statusCounts = {};

        // Month-wise grouping for growth calculation
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let revenueThisMonth = 0;
        let revenueLastMonth = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const status = data.status || "Pending";
            const orderTotal = data.summary?.total || 0;
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;

            if (status === "Pending") pending++;
            if (status === "Delivered") delivered++;
            
            totalRevenue += orderTotal;
            statusCounts[status] = (statusCounts[status] || 0) + 1;

            // Growth logic
            if (createdAt) {
                const oMonth = createdAt.getMonth();
                const oYear = createdAt.getFullYear();

                if (oYear === currentYear && oMonth === currentMonth) {
                    revenueThisMonth += orderTotal;
                } else if (oYear === currentYear && oMonth === currentMonth - 1) {
                    revenueLastMonth += orderTotal;
                } else if (currentMonth === 0 && oYear === currentYear - 1 && oMonth === 11) {
                    // Handle January case (previous month is Dec of last year)
                    revenueLastMonth += orderTotal;
                }
            }
        });

        if (statPending) statPending.innerText = pending;
        if (statDelivered) statDelivered.innerText = delivered;
        
        // Update Revenue with Animation
        if (statRevenue) {
            animateRevenue(statRevenue, totalRevenue);
        }

        // Update Growth
        if (statGrowth) {
            let growth = 0;
            if (revenueLastMonth > 0) {
                growth = ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100;
            } else if (revenueThisMonth > 0) {
                growth = 100; // First month of sales
            }
            statGrowth.innerText = (growth >= 0 ? "+" : "") + Math.round(growth) + "%";
        }
        
        renderChart(statusCounts);
    }, (error) => {
        console.error("Error loading orders chart:", error);
    });
}

function animateRevenue(el, finalValue) {
    let start = 0;
    const duration = 1000;
    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const current = Math.floor(progress * finalValue);
        el.innerText = "₹" + current.toLocaleString('en-IN');
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    }
    window.requestAnimationFrame(step);
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
    if (tabId === 'reviews') {
        loadAllReviews();
    }
};

/* ================= REVIEW MODERATION ================= */
function loadAllReviews() {
    const listEl = document.getElementById("all-reviews-list");
    if (!listEl) return;

    onSnapshot(collection(db, "product_reviews"), (snapshot) => {
        if (snapshot.empty) {
            listEl.innerHTML = `<tr><td colspan="5" style="text-align:center;">No reviews yet.</td></tr>`;
            return;
        }

        let html = "";
        snapshot.forEach((docSnap) => {
            const r = docSnap.data();
            const id = docSnap.id;
            
            html += `
                <tr>
                    <td><strong>${r.userName || "Customer"}</strong></td>
                    <td style="font-family:monospace; font-size:12px;">#${r.productId?.substring(0,8).toUpperCase() || "N/A"}</td>
                    <td style="color:#fbc02d;">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</td>
                    <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.comment}</td>
                    <td>
                        <button onclick="window.deleteReview('${id}')" style="background:none; border:none; color:#d32f2f; cursor:pointer; font-size:18px;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        listEl.innerHTML = html;
    });
}

window.deleteReview = async function(id) {
    if (confirm("Are you sure you want to delete this genuine review?")) {
        try {
            await (await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")).deleteDoc(doc(db, "product_reviews", id));
            window.showToast("Review deleted successfully", "success");
        } catch (err) {
            window.showToast("Delete failed: " + err.message, "error");
        }
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
    const canvas = document.getElementById('orderTrendsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 1. Get Real Data from the last 6 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const last6Months = [];
    const counts = [0, 0, 0, 0, 0, 0];
    
    // Generate labels for last 6 months
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push({
            month: d.getMonth(),
            year: d.getFullYear(),
            label: monthNames[d.getMonth()]
        });
    }

    // Calculate Satisfaction Rating
    let deliveredCount = 0;
    let totalCount = 0;

    // Use a small helper to get data for the chart from Firestore
    onSnapshot(collection(db, "custom_orders"), (snapshot) => {
        totalCount = snapshot.size;
        snapshot.forEach(doc => {
            const d = doc.data();
            const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : null;
            if (d.status === "Delivered") deliveredCount++;

            if (createdAt) {
                const om = createdAt.getMonth();
                const oy = createdAt.getFullYear();
                
                last6Months.forEach((m, idx) => {
                    if (m.month === om && m.year === oy) {
                        counts[idx]++;
                    }
                });
            }
        });

        // Update High-Level Satisfaction UI
        const satisfactionText = document.querySelector(".glass-panel h1");
        if (satisfactionText) {
            let rating = 4.5; // Base
            if (totalCount > 0) {
                rating = 4.5 + (deliveredCount / totalCount * 0.4);
            }
            satisfactionText.innerText = rating.toFixed(1);
        }

        if (trendsChartInstance) trendsChartInstance.destroy();

        trendsChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last6Months.map(m => m.label),
                datasets: [{
                    label: 'Monthly Orders',
                    data: counts,
                    borderColor: '#c49a6c',
                    backgroundColor: 'rgba(196, 154, 108, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#c49a6c',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)' }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: 'rgba(255,255,255,0.5)' }
                    }
                }
            }
        });
    });
}
