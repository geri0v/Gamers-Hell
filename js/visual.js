// visual.js — Fully Updated + Event Dropdown + Terminal + Sticky UI + Scroll

import { loadAndEnrichData } from './infoload.js';
import { renderSearchBar, renderFilterBar, renderSortButtons, filterEvents } from './search.js';
import { renderEventGroups } from './card.js';
import { groupByExpansionAndSource } from './event.js';
import { paginate } from './pagination.js';
import { appendTerminal, startTerminal, endTerminal } from './terminal.js';

// --- State
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

// --- UI Update Render
function updateUI() {
  const filtered = filterEvents(allEvents, currentFilters);
  const sorted = currentSort ? applySort(filtered, currentSort) : filtered;
  const paginated = paginate(sorted, pageSize, currentPage);
  const grouped = groupByExpansionAndSource(paginated);

  const app = document.getElementById('app');
  app.innerHTML = '';

  // Top sticky filter/search bar
  const topUI = document.createElement('div');
  topUI.className = 'top-ui-bar';

  // Search Bar
  topUI.appendChild(renderSearchBar(term => {
    currentFilters.searchTerm = term;
    updateUI();
  }));

  // Filter Bar (Expansion | Event | Rarity | Loot Type)
  topUI.appendChild(renderFilterBar({
    expansions: getUnique(allEvents.map(e => e.expansion)),
    events: getUnique(allEvents.map(e => e.name)),
    rarities: getUnique(allEvents.flatMap(e => (e.loot || []).map(l => l.rarity))),
    current: currentFilters
  }, (key, val) => {
    currentFilters[key] = val;
    updateUI();
  }));

  // Sort Buttons
  topUI.appendChild(renderSortButtons(key => {
    currentSort = key;
    updateUI();
  }));

  app.appendChild(topUI);
  app.appendChild(renderEventGroups(grouped));

  // Add Infinite Scroll Sentinel
  if (!document.getElementById('infinite-scroll-sentinel')) {
    const sentinel = document.createElement('div');
    sentinel.id = 'infinite-scroll-sentinel';
    sentinel.style.height = '1px';
    app.appendChild(sentinel);
    setupInfiniteScroll();
  }
}

// --- Infinite Scroll Logic
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

// --- Boot Function
async function boot() {
  startTerminal();

  try {
    appendTerminal('📦 Loading event data...', 'progress');
    const events = await loadAndEnrichData(event => {
      appendTerminal(`✓ Loaded: ${event.name} [${event.map}]`, 'success');
    });

    allEvents = events;
    currentPage = 1;
    updateUI();

    appendTerminal(`✅ ${events.length} events loaded`, 'success');
    endTerminal(true);
  } catch (err) {
    console.error(err);
    appendTerminal('🔥 Error loading event data.', 'error');
    endTerminal(false);
  }
}

window.addEventListener('DOMContentLoaded', boot);
