export function setupToggles() {
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('toggle-btn')) {
      const targetId = e.target.getAttribute('data-target');
      const el = document.getElementById(targetId);
      if (el) {
        el.classList.toggle('hidden');
        e.target.setAttribute('aria-expanded', el.classList.contains('hidden') ? "false" : "true");
      }
    }
  });
}
