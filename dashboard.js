import { 
    doc, 
    getDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    onSnapshot,
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Dashboard: User authenticated", user.uid);
        await loadUserData(user.uid);
        loadCustomOrders(user.uid); // Start real-time order tracking
        await updateWishlistCount();
    } else {
        // Not logged in, redirect to login
        console.log("Dashboard: No user found, redirecting...");
        window.location.href = "login.html";
    }
});

// Load Custom Orders (Real-time)
function loadCustomOrders(uid) {
    const ordersList = document.getElementById("order-history");
    const activeStat = document.querySelector(".stat-card h3"); // First stat card is active orders

    const q = query(
        collection(db, "custom_orders"), 
        where("userId", "==", uid),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-box-open"></i>
                    <p>No custom orders yet. Tell us your dream furniture!</p>
                    <a href="custom-order.html" class="btn-primary">Start Custom Order</a>
                </div>
            `;
            if (activeStat) activeStat.innerText = "0";
            return;
        }

        let ordersHTML = "";
        let activeCount = 0;

        snapshot.forEach((doc) => {
            const order = doc.data();
            const status = order.status || "Pending";
            if (status !== "Delivered") activeCount++;

            // Map status to progress percentage
            const progressMap = {
                "Pending": 20,
                "Designing": 40,
                "Material Selection": 60,
                "Production": 80,
                "Delivered": 100
            };
            const progress = progressMap[status] || 20;

            ordersHTML += `
                <div class="order-card card">
                    <div class="order-header">
                        <div class="order-info">
                            <h4>${order.furniture.type}</h4>
                            <span>ID: #${doc.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                        <div class="order-status-badge status-${status.toLowerCase().replace(" ", "-")}">
                            ${status}
                        </div>
                    </div>
                    
                    <div class="order-details">
                        <p><strong>Material:</strong> ${order.preferences.material}</p>
                        <p><strong>Size:</strong> ${order.furniture.dimensions.length}x${order.furniture.dimensions.width} ${order.furniture.dimensions.unit}</p>
                    </div>

                    <div class="progress-container">
                        <div class="progress-labels">
                            <span>Request</span>
                            <span>Design</span>
                            <span>Material</span>
                            <span>Production</span>
                            <span>Ready</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </div>
            `;
        });

        ordersList.innerHTML = ordersHTML;
        if (activeStat) activeStat.innerText = activeCount;
    });
}


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
