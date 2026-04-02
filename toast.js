/* toast.js */
function showToast(message, type = "success", duration = 4000) {
  // 1. Check if toast container exists
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  // 2. Create toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon = type === "success" ? "fa-circle-check" : "fa-circle-exclamation";

  toast.innerHTML = `
    <div class="toast-content">
      <i class="fa-solid ${icon} toast-icon"></i>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    <div class="toast-progress"></div>
  `;

  // 3. Append to container
  container.appendChild(toast);

  // 4. Progress bar animation
  const progress = toast.querySelector(".toast-progress");
  progress.style.transition = `width ${duration}ms linear`;
  setTimeout(() => {
    progress.style.width = "0%";
  }, 10);

  // 5. Automatic removal
  setTimeout(() => {
    toast.classList.add("hiding");
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 400);
  }, duration);
}

// Attach to window object for global access
window.showToast = showToast;
