import { 
    auth, 
    db, 
    onAuthStateChanged, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    onSnapshot,
    serverTimestamp
} from './firebase.js';

let currentUser = null;

// Initialize Dashboard
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        if (userData && userData.role === 'partner') {
            setupDashboard(userData);
            loadLeads();
            loadCatalog();
            loadEarnings();
        } else {
            window.location.href = 'index.html'; // Redirect non-partners
        }
    } else {
        window.location.href = 'login.html';
    }
});

function setupDashboard(userData) {
    document.getElementById('partner-name-header').textContent = userData.firstName || 'Partner';
    document.getElementById('welcome-partner').textContent = `Welcome, ${userData.showroomName || userData.firstName}`;
    
    // Setup Profile Form
    document.getElementById('prof-showroom-name').value = userData.showroomName || 'Pradeep Partner Showroom';
    document.getElementById('prof-partner-name').value = `${userData.firstName} ${userData.lastName}`;
    document.getElementById('prof-email').value = userData.email;
    document.getElementById('prof-phone').value = userData.phone || '';
    document.getElementById('prof-address').value = userData.address || '';
}

// 📋 Tab Switching
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
    
    document.getElementById(`${tabName}-section`).style.display = 'block';
    document.getElementById(`tab-${tabName}`).classList.add('active');
};

// 📝 Lead Submission
const leadForm = document.getElementById('quick-lead-form');
if (leadForm) {
    leadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('lead-name').value;
        const phone = document.getElementById('lead-phone').value;
        const product = document.getElementById('lead-product').value;

        try {
            await addDoc(collection(db, "partner_leads"), {
                partnerId: currentUser.uid,
                customerName: name,
                customerPhone: phone,
                productInterest: product,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            window.showToast('Lead submitted successfully! Our team will contact them.', 'success');
            leadForm.reset();
        } catch (error) {
            console.error("Error adding lead: ", error);
            window.showToast('Error submitting lead. Please try again.', 'error');
        }
    });
}

// 📦 Load Leads
function loadLeads() {
    const q = query(
        collection(db, "partner_leads"), 
        where("partnerId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        const recentLeadsList = document.getElementById('recent-leads-list');
        const allLeadsList = document.getElementById('all-leads-list');
        const totalLeadsEl = document.getElementById('stat-total-leads');
        
        let leadsHtml = '';
        let count = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'Just now';
            const statusClass = `status-pill ${data.status}`;
            
            leadsHtml += `
                <tr>
                    <td>${data.customerName}</td>
                    <td>${data.productInterest}</td>
                    <td><span class="${statusClass}">${data.status.toUpperCase()}</span></td>
                    <td>${date}</td>
                </tr>
            `;
            count++;
        });

        if (recentLeadsList) recentLeadsList.innerHTML = leadsHtml || '<tr><td colspan="4" style="text-align:center;">No leads yet.</td></tr>';
        if (allLeadsList) allLeadsList.innerHTML = leadsHtml || '<tr><td colspan="5" style="text-align:center;">No leads yet.</td></tr>';
        if (totalLeadsEl) totalLeadsEl.textContent = count;
    });
}

// 🛋️ Load Catalog (Fetched from products collection where isPartnerOnly is true)
function loadCatalog() {
    const catalogGrid = document.getElementById('partner-catalog-grid');
    if (!catalogGrid) return;

    // Filter by isPartnerOnly. Can be extended to show all if needed.
    const q = query(collection(db, "products"), where("isPartnerOnly", "==", true), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        let html = '';
        if (snapshot.empty) {
            catalogGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">No partner-exclusive products available yet.</div>';
            return;
        }

        snapshot.forEach((doc) => {
            const p = doc.data();
            html += `
                <div class="catalog-card">
                    <img src="${p.image}" class="catalog-img" alt="${p.name}">
                    <div class="catalog-info">
                        <span style="font-size:10px; color:var(--accent-color); font-weight:700;">${p.category.toUpperCase()}</span>
                        <h3>${p.name}</h3>
                        <div class="catalog-price">₹${p.price.toLocaleString()}</div>
                        <div class="catalog-meta">
                            <span>Exclusive Design</span>
                            <button class="btn-primary" style="padding: 5px 12px; font-size:12px;" onclick="window.showProductDetails('${doc.id}')">View Details</button>
                        </div>
                    </div>
                </div>
            `;
        });
        catalogGrid.innerHTML = html;
    });
}

// 💰 Load Earnings Real-Time
function loadEarnings() {
    const q = query(
        collection(db, "partner_leads"),
        where("partnerId", "==", currentUser.uid),
        where("status", "in", ["converted", "paid"])
    );

    onSnapshot(q, (snapshot) => {
        let total = 0;
        let pending = 0;
        let paid = 0;
        let tableHtml = '';

        snapshot.forEach((doc) => {
            const data = doc.data();
            const commission = data.commissionAmount || 0;
            const status = data.paymentStatus || 'pending';
            
            total += commission;
            if (status === 'pending') pending += commission;
            if (status === 'paid') paid += commission;

            tableHtml += `
                <tr>
                    <td>#LD-${doc.id.substring(0,6).toUpperCase()}</td>
                    <td>${data.customerName}</td>
                    <td>${data.commissionRate || '5%'}</td>
                    <td>₹${commission.toLocaleString()}</td>
                    <td><span class="status-pill ${status}">${status.toUpperCase()}</span></td>
                </tr>
            `;
        });

        document.getElementById('stat-earnings').textContent = `₹${total.toLocaleString()}`;
        document.getElementById('earnings-pending').textContent = `₹${pending.toLocaleString()}`;
        document.getElementById('earnings-paid').textContent = `₹${paid.toLocaleString()}`;
        
        const earningsTable = document.getElementById('earnings-table');
        if (earningsTable) {
            earningsTable.innerHTML = tableHtml || `<tr><td colspan="5" style="text-align:center;">No commissionable conversions yet.</td></tr>`;
        }
    });
}

// Logout
window.logout = function() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    });
};
