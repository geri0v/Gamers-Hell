// https://geri0v.github.io/Gamers-Hell/js/toggle.js

export function setupToggles() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.onclick = () => {
      const target = document.getElementById(btn.getAttribute('data-target'));
      if (target) {
        const open = !target.classList.contains('hidden');
        btn.setAttribute('aria-expanded', !open);
        target.classList.toggle('hidden', open);
        btn.textContent = open ? 'Show' : 'Hide';
      }
    };
    btn.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') btn.click();
    };
  });
}
