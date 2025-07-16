// visual.js — Step 7 Full Version (with Smart Cache)

import { loadAndEnrichData } from './infoload.js';
import { renderSearchBar, renderFilterBar, renderSortButtons, filterEvents } from './search.js';
import { renderEventGroups } from './card.js';
import { groupByExpansionAndSource } from './event.js';
import { paginate } from './pagination.js';
import { appendTerminal, startTerminal, endTerminal } from './terminal.js';
import { saveEventCache, loadEventCache, getCacheInfo, clearEventCache } from './cache.js';

let allEvents = [];
let currentFilters = {
  searchTerm: '',
  expansion: '',
  rarity: '',
  lootType: '',
  itemType: '',
  eventName: ''
};
let currentSort = '';
let currentPage = 1;
const pageSize = 20;

// --- Helpers
function getUnique(list) {
  return [...new Set(list.filter(Boolean))].sort().map(v => ({ val: v, text: v }));
}

function applySort(events, key) {
  return events.slice().sort((a, b) => {
    switch (key) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'map':
        return (a.map || '').localeCompare(b.map || '');
      case 'value': {
        const aVal = Math.max(...(a.loot || []).map(i => i.price || 0));
        const bVal = Math.max(...(b.loot || []).map(i => i.price || 0));
        return bVal - aVal;
      }
      default:
        return 0;
    }
  });
}

// --- Optional Cache Meta UI
function renderCacheInfoBar() {
  const info = getCacheInfo();
  const bar = document.createElement('div');
  bar.className = 'cache-info-bar';
  bar.textContent = info
    ? `🧠 Cache: ${new Date(info.timestamp).toLocaleString()} • Events: ${info.size} • Expired: ${info.expired ? 'Yes' : 'No'}`
    : 'Cache: not set';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear Cache';
  clearBtn.onclick = () => {
    clearEventCache();
    appendTerminal('🧹 Cache cleared.', 'info');
    updateUI();
  };
  bar.appendChild(clearBtn);
  return bar;
}

// --- Main UI Render
function updateUI() {
  const filtered = filterEvents(allEvents, currentFilters);
  const sorted = currentSort ? applySort(filtered, currentSort) : filtered;
  const paginated = paginate(sorted, pageSize, currentPage);
  const grouped = groupByExpansionAndSource(paginated);

  const app = document.getElementById('app');
  app.innerHTML = '';

  const topUI = document.createElement('div');
  topUI.className = 'top-ui-bar';

  topUI.appendChild(renderSearchBar(term => {
    currentFilters.searchTerm = term;
    updateUI();
  }));

  topUI.appendChild(renderFilterBar({
    expansions: getUnique(allEvents.map(e => e.expansion)),
    events: getUnique(allEvents.map(e => e.name)),
    rarities: getUnique(allEvents.flatMap(e => (e.loot || []).map(l => l.rarity))),
    current: currentFilters
  }, (key, val) => {
    currentFilters[key] = val;
    updateUI();
  }));

  topUI.appendChild(renderSortButtons(key => {
    currentSort = key;
    updateUI();
  }));

  // Add Cache Info Bar below filter/search
  topUI.appendChild(renderCacheInfoBar());

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

// --- Infinite Scroll
function setupInfiniteScroll() {
  const sentinel = document.getElementById('infinite-scroll-sentinel');
  if (!sentinel) return;

  if (window.infiniteScrollObserver) {
    window.infiniteScrollObserver.disconnect();
  }

  window.infiniteScrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      const filtered = filterEvents(allEvents, currentFilters);
      const sorted = currentSort ? applySort(filtered, currentSort) : filtered;
      const paginated = paginate(sorted, pageSize, currentPage);

      if (paginated.length < sorted.length) {
        currentPage++;
        updateUI();
      }
    }
  }, { root: null, rootMargin: '0px', threshold: 1 });

  window.infiniteScrollObserver.observe(sentinel);
}

// --- Boot
async function boot() {
  startTerminal();

  let events = loadEventCache();
  if (events) {
    appendTerminal('⚡ Using cached event data.', 'success');
  } else {
    appendTerminal('🌐 Enriching event data...', 'progress');
    events = await loadAndEnrichData(e => {
      appendTerminal(`➕ ${e.name} loaded [${e.map}]`, 'info');
    });
    saveEventCache(events);
    appendTerminal('📦 Cached event data for future loads.', 'info');
  }

  allEvents = events;
  currentPage = 1;
  updateUI();

  appendTerminal(`✅ ${events.length} events ready.`, 'success');
  endTerminal(true);
}

window.addEventListener('DOMContentLoaded', boot);
