// menu.js

// You must expose groupEvents and filteredEvents from cmd.js, e.g.:
// window.groupEvents = groupEvents;
// window.filteredEvents = filteredEvents;
// Or, add this at the end of your cmd.js:
// window.getEventGroups = () => groupEvents(filteredEvents);

let menuState = {}; // {expansion: {collapsed: bool, sources: {source: bool}}}

function ensureMenuState(groups) {
  Object.keys(groups).forEach(exp => {
    if (!menuState[exp]) menuState[exp] = {collapsed: false, sources: {}};
    Object.keys(groups[exp]).forEach(src => {
      if (typeof menuState[exp].sources[src] === "undefined") menuState[exp].sources[src] = false;
    });
  });
}

// Render the menu
function renderMenu() {
  // Get grouped data from cmd.js (filteredEvents should reflect current search/filter)
  const groups = (window.getEventGroups && window.getEventGroups()) || {};
  ensureMenuState(groups);

  const menu = document.getElementById('menu');
  if (!menu) return;
  menu.innerHTML = '<div class="menu-title">Expansions</div>';

  Object.entries(groups).forEach(([expansion, sources]) => {
    // Expansion header
    const expId = `expansion-${expansion.replace(/\s+/g, '_')}`;
    const expDiv = document.createElement('div');
    expDiv.className = 'menu-expansion';

    // Toggle arrow
    const arrow = menuState[expansion].collapsed ? '▶' : '▼';
    expDiv.innerHTML = `<div class="menu-exp-header" style="cursor:pointer" onclick="toggleMenuExpansion('${expansion.replace(/'/g, "\\'")}')">${arrow} <span class="menu-exp-link" onclick="event.stopPropagation();jumpToSection('${expId}')">${expansion}</span></div>`;

    // Sources list
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

// Toggle source collapse (not used for scrolling, just for future extensibility)
function toggleMenuSource(expansion, source) {
  menuState[expansion].sources[source] = !menuState[expansion].sources[source];
  renderMenu();
}

// Smooth scroll to section
function jumpToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
}

// Make functions globally accessible for inline handlers
window.toggleMenuExpansion = toggleMenuExpansion;
window.toggleMenuSource = toggleMenuSource;
window.jumpToSection = jumpToSection;

// Re-render menu on DOMContentLoaded and after each main render
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(renderMenu, 500); // Wait for cmd.js to load and group data
});

// If your app updates filteredEvents/groups dynamically (e.g. on search/sort), 
// call renderMenu() after each main render in cmd.js for perfect sync.
