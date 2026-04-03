import { products } from "./database.js";
import { auth, db } from "./firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ================= RENDER PRODUCTS ================= */
window.renderProducts = function () {
  const container = document.querySelector(".products");
  if (!container) return;

  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  container.innerHTML = "";

  products.forEach((item, i) => {
    let cartItem = cart.find(c => c.name === item.name);
    let qty = cartItem ? cartItem.qty : 0;

    let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
    let isLiked = wishlist.some(w => w.name === item.name);
    let heartIconClass = isLiked ? "fa-solid" : "fa-regular";
    let likedClass = isLiked ? "liked" : "";

    let btnHTML = "";
    if (qty > 0) {
      btnHTML = `
        <div class="qty-control">
          <button class="qty-btn minus" onclick="updateQty('${item.name}', -1, this)">-</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn plus" onclick="updateQty('${item.name}', 1, this)">+</button>
        </div>
      `;
    } else {
      btnHTML = `
        <button class="add" onclick="addToCart('${item.name}', ${item.price}, '${item.image}', this)">
          Add to Cart
        </button>
      `;
    }

    container.innerHTML += `
    <div class="product-card">
      <div class="card-img">
        <img src="${item.image}" alt="" class="product-img">
        <div class="wishlist ${likedClass}" onclick="toggleWishlist(this, '${item.name}', ${item.price}, '${item.image}')">
          <i class="${heartIconClass} fa-heart"></i>
        </div>
      </div>

      <div class="card-content">
        <div class="card-header-info">
          <span class="product-id">ID: #PF-${item.id || 'N/A'}</span>
          <div class="rating">
            <i class="fa-solid fa-star"></i>
            <i class="fa-solid fa-star"></i>
            <i class="fa-solid fa-star"></i>
            <i class="fa-solid fa-star"></i>
            <i class="fa-solid fa-star-half-stroke"></i>
            <span class="review-text">135</span>
          </div>
        </div>
        
        <h3>${item.name}</h3>
        <p class="price">₹${item.price}</p>

        <div class="card-buttons">
          ${btnHTML}
          <button class="custom" onclick="goToCustom('${item.name}', ${item.price}, '${item.image}')">
            Customize
          </button>
        </div>
      </div>
    </div>
    `;
  });
};

/* ================= CART COUNT ================= */
window.updateCartCount = function () {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let total = cart.reduce((sum, item) => sum + (item.qty || 0), 0);

  let countEl = document.getElementById("cart-count");
  if (countEl) {
    countEl.innerText = total;
  }
};

/* ================= FLY ANIMATION ================= */
window.flyToCart = function (btn) {
  if (!btn) return;
  let productCard = btn.closest(".product-card");
  let img = productCard?.querySelector(".product-img");
  let cartIcon = document.querySelector(".cart-icon i");

  if (img && cartIcon) {
    let imgRect = img.getBoundingClientRect();
    let cartRect = cartIcon.getBoundingClientRect();

    let flyingImg = img.cloneNode(true);
    flyingImg.classList.add("fly-img");
    document.body.appendChild(flyingImg);

    flyingImg.style.position = "fixed";
    flyingImg.style.top = imgRect.top + "px";
    flyingImg.style.left = imgRect.left + "px";

    setTimeout(() => {
      flyingImg.style.top = cartRect.top + "px";
      flyingImg.style.left = cartRect.left + "px";
      flyingImg.style.width = "30px";
      flyingImg.style.height = "30px";
      flyingImg.style.opacity = "0.5";
    }, 10);

    setTimeout(() => {
      flyingImg.remove();
      cartIcon.classList.add("cart-bounce");
      setTimeout(() => {
        cartIcon.classList.remove("cart-bounce");
      }, 400);
    }, 800);
  }
};

/* ================= UPDATE QTY ================= */
window.updateQty = function (name, change, btn) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let existing = cart.find(item => item.name === name);

  if (existing) {
    existing.qty += change;
    if (existing.qty <= 0) {
      cart = cart.filter(item => item.name !== name);
    } else if (change > 0 && btn) {
      window.flyToCart(btn);
    }
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  window.updateCartCount();
  window.renderProducts();

  window.dispatchEvent(new Event("cartUpdated"));
};

/* ================= ADD TO CART ================= */
window.addToCart = function (name, price, image, btn) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let existing = cart.find(item => item.name === name);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      name: name,
      price: price,
      image: image,
      qty: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  console.log("✅ Cart Updated:", cart);

  window.updateCartCount();

  if (btn) {
    window.flyToCart(btn);
  }

  window.renderProducts();
  window.dispatchEvent(new Event("cartUpdated"));
};

/* ================= WISHLIST TOGGLE ================= */
window.toggleWishlist = async function (el, name, price, image) {
  let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
  let index = wishlist.findIndex(item => item.name === name);

  if (index !== -1) {
    wishlist.splice(index, 1);
  } else {
    wishlist.push({ name, price, image });
  }

  localStorage.setItem("wishlist", JSON.stringify(wishlist));
  
  // SYNC WITH FIRESTORE IF LOGGED IN
  const user = auth.currentUser;
  if (user) {
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        wishlist: wishlist
      });
      console.log("Wishlist synced to Firestore");
    } catch (error) {
      console.error("Firestore Wishlist Sync Error:", error);
    }
  }

  if (window.updateWishlistCount) window.updateWishlistCount();
  window.renderProducts();
};

/* ================= SEARCH ================= */
const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", function () {

  const value = this.value.toLowerCase();

  const cards = document.querySelectorAll(".product-card");

  cards.forEach(card => {

    const title = card.querySelector("h3").innerText.toLowerCase();

    const id = card.querySelector(".product-id")?.innerText.toLowerCase();

    if (title.includes(value) || (id && id.includes(value))) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }

  });

});



const section = document.getElementById("tiltSection");
const text = document.querySelector(".tilt-text");

section.addEventListener("mousemove", (e) => {

  const rect = section.getBoundingClientRect();

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const rotateY = ((x - centerX) / centerX) * 10; // left-right
  const rotateX = -((y - centerY) / centerY) * 10; // up-down

  text.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

section.addEventListener("mouseleave", () => {
  text.style.transform = "rotateX(0deg) rotateY(0deg)";
});


/* ================= INIT ================= */
window.updateCartCount();
window.renderProducts();