// visual.js
// Main app entry. Loads full map->event->loot dataset and renders it with filters/sorting.

import { generateDeepEventDataset } from './eventdata.js';
import { renderSearchBar, renderFilterBar, renderSortButtons, filterEvents } from './search.js';
import { renderEventGroups } from './card.js';
import { paginate } from './pagination.js';
import { startTerminal, endTerminal, appendTerminal } from './terminal.js';

let allEvents = [];
let currentFilters = {
  searchTerm: '',
  expansion: '',
  region: '',
  rarity: '',
  lootType: '',
  eventName: ''
};
let currentSort = '';
let currentPage = 1;
const pageSize = 25;

// === UI Helpers ===

function getUnique(list) {
  return [...new Set(list.filter(Boolean))].sort().map(v => ({ val: v, text: v }));
}

function applySort(events, sortKey) {
  return events.slice().sort((a, b) => {
    switch (sortKey) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'map':
        return a.map.localeCompare(b.map);
      case 'value': {
        const aVal = Math.max(...(a.loot || []).map(i => i.value || 0));
        const bVal = Math.max(...(b.loot || []).map(i => i.value || 0));
        return bVal - aVal;
      }
      default:
        return 0;
    }
  });
}

// === UI Renderer ===

function updateUI() {
  const filtered = filterEvents(allEvents, currentFilters);
  const sorted = currentSort ? applySort(filtered, currentSort) : filtered;
  const paginated = paginate(sorted, pageSize, currentPage);
  const grouped = groupByMap(sorted);

  const app = document.getElementById('app');
  app.innerHTML = '';

  const topUI = document.createElement('div');
  topUI.className = 'top-ui-bar';

  topUI.appendChild(
    renderSearchBar(term => {
      currentFilters.searchTerm = term;
      updateUI();
    })
  );

  topUI.appendChild(
    renderFilterBar({
      expansions: getUnique(allEvents.map(e => e.expansion)),
      maps: getUnique(allEvents.map(e => e.map)),
      eventNames: getUnique(allEvents.map(e => e.name)),
      rarities: getUnique(allEvents.flatMap(e => (e.loot || []).map(l => l.rarity))),
      current: currentFilters
    }, (filterKey, filterVal) => {
      currentFilters[filterKey] = filterVal;
      updateUI();
    })
  );

  topUI.appendChild(
    renderSortButtons(key => {
      currentSort = key;
      updateUI();
    })
  );

  app.appendChild(topUI);
  app.appendChild(renderEventGroups(grouped));

  if (!document.getElementById('infinite-scroll-sentinel')) {
    const sentinel = document.createElement('div');
    sentinel.id = 'infinite-scroll-sentinel';
    sentinel.style.height = '1px';
    app.appendChild(sentinel);
    setupInfiniteScroll();
  }
}

// === Group Events by Map ===

function groupByMap(events) {
  const grouped = {};
  for (const ev of events) {
    if (!grouped[ev.map]) grouped[ev.map] = [];
    grouped[ev.map].push(ev);
  }

  return Object.entries(grouped).map(([mapName, items]) => ({
    map: mapName,
    items
  }));
}

// === Infinite Scroll ===

function setupInfiniteScroll() {
  const sentinel = document.getElementById('infinite-scroll-sentinel');
  if (!sentinel) return;

  if (window.infiniteScrollObserver) {
    window.infiniteScrollObserver.disconnect();
  }

  window.infiniteScrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      const filtered = filterEvents(allEvents, currentFilters);
      if (paginate(filtered, pageSize, currentPage).length < filtered.length) {
        currentPage++;
        updateUI();
      }
    }
  }, { root: null, threshold: 1 });

  window.infiniteScrollObserver.observe(sentinel);
}

// === Boot ===

async function boot() {
  startTerminal();
  appendTerminal('⚡ Loading event & loot database...', 'info');

  allEvents = [];
  currentPage = 1;

  const groupedEvents = await generateDeepEventDataset();

  // Flatten into array all events per map
  allEvents = Object.values(groupedEvents).flat();

  appendTerminal(`✓ Loaded ${allEvents.length} enriched events.`, 'success');

  updateUI();
  endTerminal(true);
}

window.addEventListener('DOMContentLoaded', boot);
