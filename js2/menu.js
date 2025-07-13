// == Gamers-Hell: Cardlike Menu.js ==

window.renderMenu = function(menuStructure) {
  const menuDiv = document.getElementById('menu-placeholder');
  if (!menuDiv) return;
  menuDiv.innerHTML = ''; // Clear previous

  Object.entries(menuStructure).forEach(([expansion, sources]) => {
    // Expansion Card
    const expCard = document.createElement('div');
    expCard.className = 'menu-card';
    expCard.style.marginBottom = '1.2rem';
    expCard.innerHTML = `
      <div class="card-header" style="cursor:pointer;">
        <span style="font-family: var(--font-heading); color: var(--color-accent-gold); font-size:1.15rem;">
          ${expansion}
        </span>
      </div>
      <div class="card-body">
        <ul class="menu-links">
          ${sources.map(src =>
            `<li>
              <a href="#" data-expansion="${expansion}" data-source="${src}">
                <span style="font-family: var(--font-accent); color: var(--color-accent-emerald);">${src}</span>
              </a>
            </li>`
          ).join('')}
        </ul>
      </div>
    `;
    menuDiv.appendChild(expCard);
  });

  // Add click handlers to menu links for filtering
  menuDiv.querySelectorAll('.menu-links a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const exp = link.getAttribute('data-expansion');
      const src = link.getAttribute('data-source');
      if (window.allEvents && window.filteredEvents && window.render) {
        // Filter by expansion and source
        window.filteredEvents = window.allEvents.filter(ev =>
          ev.expansion === exp && ev.sourceName === src
        );
        window.render();
      }
    });
  });
};
