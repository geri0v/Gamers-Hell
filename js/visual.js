// js/visual.js
import { loadAndEnrichData } from './infoload.js';
import { filterEvents, renderSortButtons, renderFilterBar, renderSearchBar } from './search.js';
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
        const aVal = Math.max(...(a.loot || []).map(i => i.price || i.vendorValue || 0));
        const bVal = Math.max(...(b.loot || []).map(i => i.price || i.vendorValue || 0));
        return bVal - aVal;
      }
      default:
        return 0;
    }
  });
}

function updateUI() {
  const filtered = filterEvents(allEvents, currentFilters);
  const sorted = currentSort ? applySort(filtered, currentSort) : filtered;
  const paginated = paginate(sorted, pageSize, currentPage);
  const grouped = groupByMap(paginated);

  const app = document.getElementById('app');
  app.innerHTML = '';

  const topUI = document.createElement('div');
  topUI.className = 'top-ui-bar';

  topUI.appendChild(
    renderSearchBar(term => {
      currentFilters.searchTerm = term;
      currentPage = 1;
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
      currentPage = 1;
      updateUI();
    })
  );

  topUI.appendChild(
    renderSortButtons(key => {
      currentSort = key;
      currentPage = 1;
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

async function boot() {
  startTerminal();
  appendTerminal('⚡ Data verrijken en laden...', 'info');
  allEvents = [];
  currentPage = 1;
  try {
    allEvents = await loadAndEnrichData((data) => {
      // eventueel per progress event iets tonen/appen
    });
    appendTerminal(`✓ Verrijkte events: ${allEvents.length}.`, 'success');
    updateUI();
    endTerminal(true);
  } catch (err) {
    appendTerminal('🔥 Fout bij laden/enrichen: ' + (err.message || err), 'error');
    endTerminal(false);
    console.error(err);
  }
}

window.addEventListener('DOMContentLoaded', boot);
