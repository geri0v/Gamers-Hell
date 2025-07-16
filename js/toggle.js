/**
 * Sets up all toggle buttons on the page.
 * Works on:
 * - loot cards
 * - event section tables
 * - description texts
 */
export function setupToggles() {
  const buttons = document.querySelectorAll('.toggle-btn');

  buttons.forEach(button => {
    const targetId = button.dataset.target;
    const target = document.getElementById(targetId);
    
    if (!target) return;

    const updateToggle = () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', !expanded);
      button.textContent = expanded ? 'Show' : 'Hide';
      target.classList.toggle('hidden', expanded);
    };

    // Activate on click
    button.addEventListener('click', updateToggle);

    // Keyboard: Enter/Space
    button.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        updateToggle();
      }
    });

    // Initial ARIA setup
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-expanded', 'false');
    target.classList.add('hidden'); // Default closed
  });
}
