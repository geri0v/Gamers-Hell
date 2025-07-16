// visual.js — Fully Updated Version

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
  eventName: '',
};
let currentSort = '';
let currentPage = 1;
let pageSize = 20;

// --- UI Rendering
function updateUI() {
  const filtered = filterEvents(allEvents, currentFilters);
  const sorted = currentSort ? applySort(filtered, currentSort) : filtered;
  const paginated = paginate(sorted, pageSize, currentPage);
  const grouped = groupByExpansionAndSource(paginated);

  const app = document.getElementById('app');
  app.innerHTML = '';

  // Top sticky UI
  const topUI = document.createElement('div');
  topUI.className = 'top-ui-bar';

  // Search bar
  topUI.appendChild(renderSearchBar(term => {
    currentFilters.searchTerm = term;
    updateUI();
  }));

  // Filter bar (expansions, events, rarities, loot type)
  topUI.appendChild(renderFilterBar({
    expansions: getUnique(allEvents.map(e => e.expansion)),
    rarities: getUnique(allEvents.flatMap(e => (e.loot || []).map(l => l.rarity))),
    events: getUnique(allEvents.map(e => e.name)),
    current: currentFilters
  }, (key, val) => {
    currentFilters[key] = val;
    updateUI();
  }));

  // Sort buttons
  topUI.appendChild(renderSortButtons(key => {
    currentSort = key;
    updateUI();
  }));

  app.appendChild(topUI);
  app.appendChild(renderEventGroups(grouped));
}

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

// --- Infinite Scroll (optional improvement)
function setupInfiniteScroll() {
  const sentinel = document.querySelector('#infinite-scroll-sentinel');
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

// --- Boot Logic
async function boot() {
  startTerminal();
  try {
    appendTerminal('📦 Loading event data...', 'progress');
    const events = await loadAndEnrichData(ev => {
      appendTerminal(`✓ Loaded: ${ev.name} [${ev.map}]`, 'success');
    });
    allEvents = events;

    // Initial UI render
    currentPage = 1;
    updateUI();

    // Setup infinite scroll sentinel, if present
    setTimeout(() => {
      let sentinel = document.getElementById('infinite-scroll-sentinel');
      if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'infinite-scroll-sentinel';
        sentinel.style.height = '1px';
        document.getElementById('app').appendChild(sentinel);
      }
      setupInfiniteScroll();
    }, 500);

    appendTerminal(`✅ ${events.length} events loaded.`, 'success');
    endTerminal(true);
  } catch (e) {
    appendTerminal('🔥 Error loading data!', 'error');
    console.error(e);
    endTerminal(false);
  }
}

window.addEventListener('DOMContentLoaded', boot);
