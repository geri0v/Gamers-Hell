import { loadAndEnrichData } from './infoload.js';
import { renderSearchBar, renderFilterBar, renderSortButtons, filterEvents } from './search.js';
import { renderEventGroups } from './card.js';
import { groupByExpansionAndSource } from './event.js';
import { paginate } from './pagination.js';
import { appendTerminal, startTerminal, endTerminal } from './terminal.js';

let allEvents = [];
let currentFilters = { searchTerm: '', expansion: '', rarity: '', lootType: '', eventName: '' };
let currentSort = '';
let currentPage = 1;
let pageSize = 20;

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
    rarities: getUnique(allEvents.flatMap(e => e.loot?.map(l => l.rarity))),
    events: getUnique(allEvents.map(e => e.name)), // for event dropdown
    current: currentFilters
  }, (key, val) => {
    currentFilters[key] = val;
    updateUI();
  }));

  topUI.appendChild(renderSortButtons(key => {
    currentSort = key;
    updateUI();
  }));

  app.appendChild(topUI);
  app.appendChild(renderEventGroups(grouped));
}

function getUnique(list) {
  return [...new Set(list.filter(Boolean))].sort().map(v => ({ val: v, text: v }));
}

function applySort(events, key) {
  return events.slice().sort((a, b) => {
    switch (key) {
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'map': return (a.map || '').localeCompare(b.map || '');
      case 'value': {
        const aVal = Math.max(...(a.loot || []).map(i => i.price || 0));
        const bVal = Math.max(...(b.loot || []).map(i => i.price || 0));
        return bVal - aVal;
      }
      default: return 0;
    }
  });
}

async function boot() {
  startTerminal();

  try {
    appendTerminal('📦 Checking for cache...', 'progress');

    const events = await loadAndEnrichData(ev => {
      appendTerminal(`➕ ${ev.name} loaded [${ev.map}]`, 'success');
    });

    allEvents = events;
    applyFiltersAndRender();

    appendTerminal(`✅ Loaded ${events.length} events.`, 'success');
    endTerminal(true);

  } catch (e) {
    console.error(e);
    appendTerminal('🔥 Failed to load or enrich data.', 'error');
    endTerminal(false);
  }
}

window.addEventListener('DOMContentLoaded', boot);
