import { products } from "./database.js";

const container = document.querySelector(".products");

/* ================= RENDER PRODUCTS ================= */
function renderProducts(){

  container.innerHTML = "";

  products.forEach(product => {

    container.innerHTML += `
      <div class="product-card">

        <div class="card-img">
          <img src="${product.image}" class="product-img">
          <i class="fa-regular fa-heart wishlist"></i>
        </div>

        <div class="card-content">
          <h3>${product.name}</h3>
          <p class="price">₹${product.price}</p>

          <div class="card-buttons">

            <button class="add"
              onclick="addToCart('${product.name}', ${product.price}, '${product.image}', this)">
              Add to Cart
            </button>

            <button class="custom"
              onclick="goToCustom('${product.name}', ${product.price}, '${product.image}')">
              Customize
            </button>

          </div>
        </div>

      </div>
    `;
  });
}

renderProducts();

/* ================= CART COUNT ================= */
function updateCartCount(){
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let total = cart.reduce((sum, item) => sum + item.qty, 0);

  let countEl = document.getElementById("cart-count");
  if(countEl){
    countEl.innerText = total;
  }
}

/* ================= ADD TO CART ================= */
window.addToCart = function(name, price, image, btn){

  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  let existing = cart.find(item => item.name === name);

  if(existing){
    existing.qty += 1;
  } else {
    cart.push({ name, price, image, qty: 1 });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();

  /* 🔥 FLY ANIMATION */
  let productCard = btn.closest(".product-card");
  let img = productCard.querySelector(".product-img");
  let cartIcon = document.querySelector(".cart-icon i");

  let imgRect = img.getBoundingClientRect();
  let cartRect = cartIcon.getBoundingClientRect();

  let flyingImg = img.cloneNode(true);
  flyingImg.classList.add("fly-img");

  document.body.appendChild(flyingImg);

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

    // cart bounce
    cartIcon.classList.add("cart-bounce");
    setTimeout(() => {
      cartIcon.classList.remove("cart-bounce");
    }, 400);

  }, 800);
};

/* ================= INIT ================= */
updateCartCount();
