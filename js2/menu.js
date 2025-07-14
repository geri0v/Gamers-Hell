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
        <div class="card-header" style="cursor:pointer;" tabindex="0" role="button" aria-expanded="true">
          <span style="font-family: var(--font-heading); color: var(--color-accent-gold); font-size:1.15rem;">
            ${expansion}
          </span>
          <span class="exp-arrow" style="float:right;">▼</span>
        </div>
        <div class="card-body" style="display:block;">
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
      // Expand/collapse logic for expansion
      expCard.querySelector('.card-header').addEventListener('click', function() {
        const body = expCard.querySelector('.card-body');
        const arrow = expCard.querySelector('.exp-arrow');
        const expanded = body.style.display !== 'none';
        body.style.display = expanded ? 'none' : 'block';
        arrow.textContent = expanded ? '▼' : '▲';
      });
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
