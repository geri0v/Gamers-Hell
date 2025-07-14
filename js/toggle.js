// toggle.js
export function setupToggles() {
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('toggle-btn')) {
      const targetId = e.target.getAttribute('data-target');
      const el = document.getElementById(targetId);
      if (el) {
        el.classList.toggle('hidden');
        const isHidden = el.classList.contains('hidden');
        e.target.textContent = isHidden ? 'Show' : 'Hide';
        e.target.setAttribute('aria-expanded', !isHidden);
      }
    }
  });
}
