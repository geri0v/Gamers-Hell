export function setupToggles() {
  const buttons = document.querySelectorAll('.toggle-btn');

  buttons.forEach(button => {
    const targetId = button.dataset.target;
    const target = document.getElementById(targetId);

    if (!target) return;

    const toggleVisibility = () => {
      const shown = !target.classList.contains('hidden');
      target.classList.toggle('hidden', shown);
      button.setAttribute('aria-expanded', !shown);
      button.textContent = shown ? 'Show' : 'Hide';
    };

    button.addEventListener('click', toggleVisibility);
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleVisibility();
      }
    });
  });
}
