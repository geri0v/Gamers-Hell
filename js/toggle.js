/**
 * Attach toggle buttons for all expandable elements: loot cards, source groups, expansions, descriptions.
 */
export function setupToggles() {
  const toggles = document.querySelectorAll('.toggle-btn');

  toggles.forEach(button => {
    const targetId = button.dataset.target;
    const target = document.getElementById(targetId);
    if (!button || !target) return;

    const toggleContent = () => {
      const isExpanded = !target.classList.contains('hidden');
      target.classList.toggle('hidden', isExpanded);
      button.setAttribute('aria-expanded', String(!isExpanded));
      button.textContent = isExpanded ? 'Show' : 'Hide';
    };

    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', targetId);
    target.classList.add('hidden');
    button.textContent = 'Show';

    // Click handler
    button.addEventListener('click', toggleContent);

    // Keyboard: Enter or Space
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleContent();
      }
    });
  });
}
