let menuState = {};
function ensureMenuState(groups) {
  Object.keys(groups).forEach(exp => {
    if (!menuState[exp]) menuState[exp] = {collapsed: false, sources: {}};
    Object.keys(groups[exp]).forEach(src => {
      if (typeof menuState[exp].sources[src] === "undefined") menuState[exp].sources[src] = false;
    });
  });
}
function renderMenu() {
  const groups = (window.getEventGroups && window.getEventGroups()) || {};
  ensureMenuState(groups);
  const menu = document.getElementById('menu');
  if (!menu) return;
  menu.innerHTML = `<div class="menu-title">Expansions</div>`;
  Object.entries(groups).forEach(([expansion, sources]) => {
    const expId = `expansion-${expansion.replace(/\s+/g, '_')}`;
    const expDiv = document.createElement('div');
    expDiv.className = 'menu-card';
    const arrow = menuState[expansion].collapsed ? '▶' : '▼';
    expDiv.innerHTML = `<div class="menu-exp-header" tabindex="0" role="button" aria-expanded="${!menuState[expansion].collapsed}"
      onclick="toggleMenuExpansion('${expansion.replace(/'/g, "\\'")}')">
      ${arrow} <span class="menu-exp-link" onclick="event.stopPropagation();jumpToSection('${expId}')">${expansion}</span>
    </div>`;
    const srcList = document.createElement('div');
    srcList.className = 'menu-sources';
    srcList.style.display = menuState[expansion].collapsed ? 'none' : 'block';
    Object.keys(sources).forEach(source => {
      const srcId = `${expId}-source-${source.replace(/\s+/g, '_')}`;
      const srcArrow = menuState[expansion].sources[source] ? '▶' : '▼';
      const srcDiv = document.createElement('div');
      srcDiv.className = 'menu-source menu-card';
      srcDiv.innerHTML = `<div style="cursor:pointer;display:inline" role="button" aria-expanded="${!menuState[expansion].sources[source]}"
        onclick="toggleMenuSource('${expansion.replace(/'/g, "\\'")}', '${source.replace(/'/g, "\\'")}')">
        ${srcArrow}
      </div>
      <span class="menu-source-link" onclick="event.stopPropagation();jumpToSection('${srcId}')">${source}</span>`;
      srcList.appendChild(srcDiv);
    });
    expDiv.appendChild(srcList);
    menu.appendChild(expDiv);
  });
}
function toggleMenuExpansion(expansion) {
  menuState[expansion].collapsed = !menuState[expansion].collapsed;
  renderMenu();
}
function toggleMenuSource(expansion, source) {
  menuState[expansion].sources[source] = !menuState[expansion].sources[source];
  renderMenu();
}
function jumpToSection(id) {
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
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
}
window.toggleMenuExpansion = toggleMenuExpansion;
window.toggleMenuSource = toggleMenuSource;
window.jumpToSection = jumpToSection;
document.addEventListener('DOMContentLoaded', () => setTimeout(renderMenu, 500));
