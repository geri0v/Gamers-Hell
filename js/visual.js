// visual.js (final)
import { loadAndEnrichData } from './infoload.js';
import { renderSearchBar, renderFilterBar, renderSortButtons, filterEvents } from './search.js';
import { renderEventGroups } from './card.js';
import { groupByExpansionAndSource } from './event.js';
import { paginate } from './pagination.js';

let allEvents = [];
let currentFilters = { searchTerm: '', expansion: '', rarity: '', lootType: '' };
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
  app.appendChild(renderSearchBar(term => {
    currentFilters.searchTerm = term;
    updateUI();
  }));

  app.appendChild(renderFilterBar({
    expansions: getUnique(allEvents.map(e => e.expansion)),
    rarities: getUnique(allEvents.flatMap(e => e.loot?.map(l => l.rarity))),
    current: currentFilters
  }, (key, val) => {
    currentFilters[key] = val;
    updateUI();
  }));

  app.appendChild(renderSortButtons(key => {
    currentSort = key;
    updateUI();
  }));

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

window.addEventListener('DOMContentLoaded', async () => {
  const terminal = document.querySelector('#terminal');
  terminal.classList.add('matrix-mode');

  allEvents = await loadAndEnrichData();

  setTimeout(() => terminal.classList.add('hidden'), 3000);
  updateUI();
});
