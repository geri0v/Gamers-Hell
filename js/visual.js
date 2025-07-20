// js/visual.js
import { loadAndEnrichData } from './live.js'; // <-- zorg hier dat het met "live.js" werkt!
import { filterEvents, renderSortButtons, renderFilterBar, renderSearchBar } from './search.js';
import { renderEventGroups } from './card.js';
import { paginate } from './pagination.js';
import { startTerminal, endTerminal, appendTerminal, updateTerminalProgress } from './terminal.js';

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
  return [...new Set(list.filter(Boolean && (v => v !== 'undefined')))].sort().map(v => ({ val: v, text: v }));
}
function applySort(events, sortKey) {
  return events.slice().sort((a, b) => {
    switch (sortKey) {
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'map': return (a.map || '').localeCompare(b.map || '');
      case 'value': {
        const aVal = Math.max(...(a.loot || []).map(i => i.price || i.vendorValue || 0));
        const bVal = Math.max(...(b.loot || []).map(i => i.price || i.vendorValue || 0));
        return bVal - aVal;
      }
      default: return 0;
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
    renderSearchBar(term => { currentFilters.searchTerm = term; currentPage = 1; updateUI(); })
  );
  topUI.appendChild(
    renderFilterBar({
      expansions: getUnique(allEvents.map(e => e.expansion)),
      maps: getUnique(allEvents.map(e => e.map)),
      eventNames: getUnique(allEvents.map(e => e.name)),
      rarities: getUnique(allEvents.flatMap(e => (e.loot || []).map(l => l.rarity))),
      current: currentFilters
    }, (filterKey, filterVal) => {
      currentFilters[filterKey] = filterVal; currentPage = 1; updateUI();
    })
  );
  topUI.appendChild(
    renderSortButtons(key => { currentSort = key; currentPage = 1; updateUI(); })
  );
  app.appendChild(topUI);
  app.appendChild(renderEventGroups(grouped));

  installInfiniteScrollIfNeeded(app, grouped, filtered);
}

function groupByMap(events) {
  // Even veilig (null/undefined) maken
  const grouped = {};
  for (const ev of events) {
    if (!ev.map) continue;
    if (!grouped[ev.map]) grouped[ev.map] = [];
    grouped[ev.map].push(ev);
  }
  return Object.entries(grouped).map(([mapName, items]) => ({
    map: mapName,
    items
  }));
}

function installInfiniteScrollIfNeeded(app, grouped, filtered) {
  // Alleen sentinel plaatsen als er verder gescrolled kan worden (meer dan 1 page)
  if (!document.getElementById('infinite-scroll-sentinel') && (filtered.length > pageSize)) {
    const sentinel = document.createElement('div');
    sentinel.id = 'infinite-scroll-sentinel';
    sentinel.style.height = '1px';
    app.appendChild(sentinel);
    setupInfiniteScroll();
  }
}
function setupInfiniteScroll() {
  const sentinel = document.getElementById('infinite-scroll-sentinel');
  if (!sentinel) return;
  if (window.infiniteScrollObserver) window.infiniteScrollObserver.disconnect();
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

// -------- BOOT --------
async function boot() {
  startTerminal();
  appendTerminal('⚡ Enriching & loading data (kan enkele minuten duren bij 10.000+ items!)', 'info');
  allEvents = [];
  currentPage = 1;
  try {
    allEvents = await loadAndEnrichData((phase, info) => {
      if (phase === "itemnamelist")
        updateTerminalProgress(5, "Laden alle GW2 items...");
      else if (phase === "fuzzy")
        updateTerminalProgress(10 + Math.round(40 * (info.done / info.total)), `Fuzzy-match ${info.done} / ${info.total} events...`);
      else if (phase === "fuzzyComplete") {
        updateTerminalProgress(50, "Fuzzy-matching gereed");
        if (info.unmatched?.length)
          appendTerminal(`⚠️ Niet gematched: ${info.unmatched.length} - controleer onjuiste lootnamen!`, "warn");
      }
      else if (phase === "apiEnrichment")
        updateTerminalProgress(51, `Verrijking van ${info.count} unieke items...`);
      else if (phase === "enrich")
        updateTerminalProgress(60 + Math.round(40 * (info.done / info.total)), `Finale enrichment: ${info.done} / ${info.total}`);
      else if (phase === "complete") {
        updateTerminalProgress(100, "Alle enrichment voltooid.");
        if (info.unmatched?.length)
          appendTerminal(`⚠️ ${info.unmatched.length} niet gematchte lootitems (controleer 'unmatched' log)!`, "warn");
      }
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

