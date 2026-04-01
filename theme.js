/* ================= THEME MANAGEMENT ================= */
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  const htmlEl = document.documentElement;
  const themeIcon = themeToggle.querySelector('i');

  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  htmlEl.setAttribute('data-theme', savedTheme);
  updateThemeUI(savedTheme);

  themeToggle.addEventListener('click', () => {
    if (themeToggle.classList.contains('theme-animating')) return;

    themeToggle.classList.add('theme-animating');

    setTimeout(() => {
      const currentTheme = htmlEl.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      htmlEl.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeUI(newTheme);

      themeToggle.classList.remove('theme-animating');
    }, 250); // Mid-point of CSS transition
  });

  function updateThemeUI(theme) {
    if (theme === 'dark') {
      themeIcon.className = 'fa-solid fa-sun';
      themeToggle.style.color = '#f5d27a'; // Sun color
    } else {
      themeIcon.className = 'fa-solid fa-moon';
      themeToggle.style.color = ''; // Reset to default
    }
  }
}

// Pre-init check to apply theme immediately (though head script handles initial load)
document.addEventListener('DOMContentLoaded', initTheme);
