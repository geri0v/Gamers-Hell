// menu.js

let menuState = {}; // {expansion: {collapsed: bool, sources: {source: bool}}}
let menuOpen = false;

function ensureMenuState(groups) {
  Object.keys(groups).forEach(exp => {
    if (!menuState[exp]) menuState[exp] = {collapsed: false, sources: {}};
    Object.keys(groups[exp]).forEach(src => {
      if (typeof menuState[exp].sources[src] === "undefined") menuState[exp].sources[src] = false;
    });
  });
}

// Toggle menu open/close
function toggleMenu(force) {
  menuOpen = typeof force === "boolean" ? force : !menuOpen;
  const menu = document.getElementById('menu');
  const overlay = document.getElementById('menu-overlay');
  if (menuOpen) {
    menu.classList.add('open');
    overlay.classList.add('show');
    document.body.classList.add('menu-open');
  } else {
    menu.classList.remove('open');
    overlay.classList.remove('show');
    document.body.classList.remove('menu-open');
  }
}

// Render the menu
function renderMenu() {
  const groups = (window.getEventGroups && window.getEventGroups()) || {};
  ensureMenuState(groups);

  const menu = document.getElementById('menu');
  if (!menu) return;
  menu.innerHTML = `
    <div class="menu-header">
      <span class="menu-title">Expansions</span>
      <button class="menu-close-btn" onclick="toggleMenu(false)" aria-label="Close Menu">&times;</button>
    </div>
  `;

  Object.entries(groups).forEach(([expansion, sources]) => {
    const expId = `expansion-${expansion.replace(/\s+/g, '_')}`;
    const expDiv = document.createElement('div');
    expDiv.className = 'menu-expansion';

    const arrow = menuState[expansion].collapsed ? '▶' : '▼';
    expDiv.innerHTML = `<div class="menu-exp-header" tabindex="0" onclick="toggleMenuExpansion('${expansion.replace(/'/g, "\\'")}')">${arrow} <span class="menu-exp-link" onclick="event.stopPropagation();jumpToSection('${expId}')">${expansion}</span></div>`;

    const srcList = document.createElement('div');
    srcList.className = 'menu-sources';
    srcList.style.display = menuState[expansion].collapsed ? 'none' : 'block';

    Object.keys(sources).forEach(source => {
      const srcId = `${expId}-source-${source.replace(/\s+/g, '_')}`;
      const srcArrow = menuState[expansion].sources[source] ? '▶' : '▼';
      const srcDiv = document.createElement('div');
      srcDiv.className = 'menu-source';
      srcDiv.innerHTML = `<div style="cursor:pointer;display:inline" onclick="toggleMenuSource('${expansion.replace(/'/g, "\\'")}', '${source.replace(/'/g, "\\'")}')">${srcArrow}</div>
        <span class="menu-source-link" onclick="event.stopPropagation();jumpToSection('${srcId}')">${source}</span>`;
      srcList.appendChild(srcDiv);
    });

    expDiv.appendChild(srcList);
    menu.appendChild(expDiv);
  });
}

// Toggle expansion collapse
function toggleMenuExpansion(expansion) {
  menuState[expansion].collapsed = !menuState[expansion].collapsed;
  renderMenu();
}

// Toggle source collapse
function toggleMenuSource(expansion, source) {
  menuState[expansion].sources[source] = !menuState[expansion].sources[source];
  renderMenu();
}

// Smooth scroll to section and auto-expand if needed
function jumpToSection(id) {
  // Expand section if collapsed
  const [expansionPart, ...rest] = id.split('-source-');
  const expansion = expansionPart.replace('expansion-', '').replace(/_/g, ' ');
  const source = rest.length ? rest.join('-source-').replace(/_/g, ' ') : null;
  if (menuState[expansion] && menuState[expansion].collapsed) {
    menuState[expansion].collapsed = false;
    renderMenu();
    setTimeout(() => jumpToSection(id), 100);
    return;
  }
  if (source && menuState[expansion] && menuState[expansion].sources[source]) {
    menuState[expansion].sources[source] = false;
    renderMenu();
    setTimeout(() => jumpToSection(id), 100);
    return;
  }
  toggleMenu(false);
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
}

// Expose for inline handlers
window.toggleMenu = toggleMenu;
window.toggleMenuExpansion = toggleMenuExpansion;
window.toggleMenuSource = toggleMenuSource;
window.jumpToSection = jumpToSection;

// Render menu after DOM loaded and after each main render
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(renderMenu, 500);
});
