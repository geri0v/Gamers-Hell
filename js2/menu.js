// == Gamers-Hell: menu.js ==
(function() {
  window._menuActive = window._menuActive || { expansion: null, source: null };

  window.renderMenu = function(menuStructure) {
    const menuDiv = document.getElementById('menu-placeholder');
    if (!menuDiv) return;
    menuDiv.innerHTML = '';

    Object.entries(menuStructure).forEach(([expansion, sources]) => {
      const expCard = document.createElement('div');
      expCard.className = 'menu-card';
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
                <a href="#" data-expansion="${expansion}" data-source="${src}" class="menu-link${window._menuActive.expansion === expansion && window._menuActive.source === src ? ' active' : ''}">
                  <span style="font-family: var(--font-accent); color: var(--color-accent-emerald);">${src}</span>
                </a>
              </li>`
            ).join('')}
          </ul>
        </div>
      `;
      menuDiv.appendChild(expCard);
    });

    menuDiv.querySelectorAll('.menu-links a').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const exp = link.getAttribute('data-expansion');
        const src = link.getAttribute('data-source');
        window._menuActive.expansion = exp;
        window._menuActive.source = src;
        menuDiv.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        if (window.cmd_run) {
          window.cmd_run(`show expansion "${exp}" source "${src}"`);
        }
      });
    });
  };
})();
