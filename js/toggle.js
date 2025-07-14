// https://geri0v.github.io/Gamers-Hell/js/toggle.js

export function setupToggles() {
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('toggle-btn')) {
      const targetId = e.target.getAttribute('data-target');
      const el = document.getElementById(targetId);
      if (el) {
        el.classList.toggle('hidden');
        e.target.textContent = el.classList.contains('hidden') ? 'Show Loot' : 'Hide Loot';
      }
    }
  });
}
