/**
 * Attach toggle logic to all .toggle-btn elements.
 * Handles click + keyboard (Enter/Space) toggles.
 */
export function setupToggles() {
  const buttons = document.querySelectorAll('.toggle-btn');

  buttons.forEach(btn => {
    const targetId = btn.getAttribute('data-target');
    const target = document.getElementById(targetId);

    if (!target) {
      console.warn(`Toggle target not found: ${targetId}`);
      return;
    }

    const toggle = () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !isExpanded);
      target.classList.toggle('hidden', isExpanded);
      btn.textContent = isExpanded ? 'Show' : 'Hide';
    };

    btn.addEventListener('click', toggle);
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

    // Default state
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-expanded', 'false');
    target.classList.add('hidden');
  });
}
