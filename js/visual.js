// visual.js — PART 1 of 5
import { loadAndEnrichData } from './infoload.js';
import { filterEvents, fuzzyMatch } from './search.js';
import { paginate } from './pagination.js';
import { groupAndSort } from './data.js';
import { createCopyBar, getMostValuableDrop, createMostValuableBadge } from './copy.js';
import { formatPrice } from './info.js';

// ============================
// ✅ UI Constants and Context
// ============================
let allEvents = [];      // raw loaded + enriched data
let filteredEvents = [];
let groupedData = [];
let currentPage = 1;
const pageSize = 20;

let currentFilters = {
  searchTerm: '',
  expansion: '',
  rarity: '',
  itemType: '',
  guaranteedOnly: false,
  chanceOnly: false
};

let currentSort = ''; // name, map, value

// ============================
// ✅ Terminal Hook + Redirect
// ============================
function appendTerminal(message, type = 'info') {
  const term = document.querySelector('#terminal');
  if (!term) return;

  const line = document.createElement('pre');
  line.className = `terminal-line terminal-${type}`;
  line.textContent = message;
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}

function setupConsoleRedirect() {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args) => {
    origLog(...args);
    appendTerminal(args.join(' '), 'info');
  };

  console.warn = (...args) => {
    origWarn(...args);
    appendTerminal(args.join(' '), 'warn');
  };

  console.error = (...args) => {
    origError(...args);
    appendTerminal(args.join(' '), 'error');
  };

  window.addEventListener('error', e => {
    appendTerminal(`[ERROR] ${e.message}`, 'error');
  });
}

setupConsoleRedirect();

// ============================
// ✅ Utility Functions
// ============================

function formatCopper(copper) {
  if (copper == null || isNaN(copper)) return 'N/A';
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  const parts = [];
  if (g) parts.push(`${g}g`);
  if (s) parts.push(`${s}s`);
  if (c || parts.length === 0) parts.push(`${c}c`);
  return parts.join(' ');
}

function shortenDescription(text, wikiUrl) {
  if (!text) return '';
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g);
  let shortDesc = '';
  if (sentences && sentences.length >= 2) {
    shortDesc = sentences[0] + ' ' + sentences[1];
  } else {
    shortDesc = text;
  }

  if (wikiUrl) {
    shortDesc += ` (see <a href="${wikiUrl}" target="_blank">wiki</a>)`;
  }

  return shortDesc;
}
// --- Search Bar ---
function renderSearchBar() {
  const searchWrap = document.createElement('div');
  searchWrap.className = 'search-bar';

  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Search events or maps...';
  input.autocomplete = 'off';
  input.value = currentFilters.searchTerm;
  input.setAttribute('aria-label', 'Search events or maps');

  input.addEventListener('input', e => {
    currentFilters.searchTerm = e.target.value;
    applyFiltersAndRender(true);
  });

  searchWrap.appendChild(input);
  return searchWrap;
}

// --- Filter Bar (Horizontal) ---
function renderFilterBar(onChange) {
  const container = document.createElement('div');
  container.className = 'filter-bar';

  // Helper: dropdown select
  const createSelect = (labelText, options, selectedVal) => {
    const wrap = document.createElement('label');
    wrap.className = 'filter-item';
    wrap.textContent = labelText + ': ';

    const select = document.createElement('select');
    options.forEach(({ val, text }) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      if (val === selectedVal) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', e => onChange(select.value, labelText));
    wrap.appendChild(select);
    return wrap;
  };

  // Expansion filter
  const expansions = [...new Set(allEvents.map(e => e.expansion).filter(Boolean))].sort();
  expansions.unshift('');
  container.appendChild(createSelect(
    'Expansion',
    [{ val: '', text: 'All' }, ...expansions.map(e => ({ val: e, text: e }))],
    currentFilters.expansion
  ));

  // Rarity filter
  const rarities = ['', 'Ascended', 'Exotic', 'Rare', 'Masterwork', 'Fine', 'Basic'];
  container.appendChild(createSelect(
    'Rarity',
    rarities.map(r => ({ val: r, text: r || 'All' })),
    currentFilters.rarity
  ));

  // Item type filter
  const allTypes = new Set();
  allEvents.forEach(e => {
    (e.loot || []).forEach(l => {
      if (l.type) allTypes.add(l.type);
    });
  });
  const typeOptions = ['', ...Array.from(allTypes).sort()];
  container.appendChild(createSelect(
    'Item Type',
    typeOptions.map(t => ({ val: t, text: t || 'All' })),
    currentFilters.itemType
  ));

  // Guaranteed Only checkbox (mutually exclusive)
  const guaranteedWrap = document.createElement('label');
  guaranteedWrap.className = 'filter-checkbox';
  const guaranteedInput = document.createElement('input');
  guaranteedInput.type = 'checkbox';
  guaranteedInput.checked = !!currentFilters.guaranteedOnly;
  guaranteedInput.addEventListener('change', e => onChange(e.target.checked, 'Guaranteed Only'));
  guaranteedWrap.appendChild(guaranteedInput);
  guaranteedWrap.appendChild(document.createTextNode(' Guaranteed Only'));
  container.appendChild(guaranteedWrap);

  // Chance Only checkbox
  const chanceWrap = document.createElement('label');
  chanceWrap.className = 'filter-checkbox';
  const chanceInput = document.createElement('input');
  chanceInput.type = 'checkbox';
  chanceInput.checked = !!currentFilters.chanceOnly;
  chanceInput.addEventListener('change', e => onChange(e.target.checked, 'Chance Only'));
  chanceWrap.appendChild(chanceInput);
  chanceWrap.appendChild(document.createTextNode(' Chance Only'));
  container.appendChild(chanceWrap);

  return container;
}

// --- Sort Buttons ---
function renderSortButtons(onSortChange) {
  const sortWrap = document.createElement('div');
  sortWrap.className = 'sort-bar';

  ['Name', 'Map', 'Value'].forEach(key => {
    const btn = document.createElement('button');
    btn.textContent = `Sort by ${key}`;
    btn.className = 'sort-btn';
    btn.addEventListener('click', () => onSortChange(key.toLowerCase()));
    sortWrap.appendChild(btn);
  });

  return sortWrap;
}

// To be used by core rendering logic in Part 3+
export { renderSearchBar, renderFilterBar, renderSortButtons };
// --- Event Grouped Rendering ---
function renderEventsGrouped(eventsGrouped) {
  const container = document.createElement('div');
  container.className = 'grouped-events';

  eventsGrouped.forEach(({ expansion, sources }) => {
    const expSection = document.createElement('section');
    expSection.className = 'expansion-group';
    expSection.dataset.expansion = expansion;

    // Expansion Heading
    const expTitle = document.createElement('h2');
    expTitle.textContent = expansion;
    expSection.appendChild(expTitle);

    sources.forEach(({ sourcename, items }) => {
      // Source Name
      const srcTitle = document.createElement('h3');
      srcTitle.textContent = sourcename;
      expSection.appendChild(srcTitle);

      items.forEach(event => {
        const evCard = createEventCard(event);
        expSection.appendChild(evCard);
      });
    });

    container.appendChild(expSection);
  });

  return container;
}

// --- Event Card Composition ---
function createEventCard(event) {
  const card = document.createElement('article');
  card.className = 'event-card';

  // Top Column Header: Name | Map | Waypoint
  const column = document.createElement('div');
  column.className = 'column-header';
  column.innerHTML =
    `<strong>Name:</strong> ${event.name || 'Unknown'} | ` +
    `<strong>Map:</strong> ${event.map || '?'} | ` +
    `<strong>Waypoint:</strong> ${event.waypointName || event.code || '-'}`;
  card.appendChild(column);

  // Description
  if (event.description) {
    const desc = document.createElement('p');
    desc.className = 'event-desc';
    desc.innerHTML = shortenDescription(event.description, event.wikiLink);
    card.appendChild(desc);
  }

  // Copy Bar
  card.insertAdjacentHTML('beforeend', createCopyBar(event));

  // Loot Cards (horizontal display below copy bar)
  if (event.loot && event.loot.length) {
    const lootGrid = document.createElement('div');
    lootGrid.className = 'loot-grid';

    // Place most valuable loot first, then the rest
    const sortedLoot = [...event.loot].sort((a, b) => {
      if (a.price == null && b.price == null) return 0;
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return b.price - a.price;
    });
    const mostValuable = getMostValuableDrop(event.loot);

    sortedLoot.forEach(item => {
      const lootCard = document.createElement('div');
      lootCard.className = 'loot-card';
      if (item === mostValuable) lootCard.classList.add('most-valuable');

      lootCard.innerHTML = `
        ${item.icon ? `<img src="${item.icon}" class="loot-icon" alt="${item.name} icon" />` : ''}
        <div class="loot-info">
          <a href="${item.wikiLink}" target="_blank" rel="noopener">${item.name}</a>
          <div class="loot-meta">
            ${formatCopper(item.price)}
            ${item.vendorValue != null ? `<span> | Vendor: ${formatCopper(item.vendorValue)}</span>` : ''}
            ${item.accountBound ? '<span> | Accountbound</span>' : ''}
            ${item.guaranteed ? ' | <span style="color:#6fed81;">Guaranteed</span>' : ''}
            ${item === mostValuable ? createMostValuableBadge(item) : ''}
          </div>
        </div>
      `;
      lootGrid.appendChild(lootCard);
    });
    card.appendChild(lootGrid);
  }

  return card;
}
// Infinite scroll logic to load more results when scrolled to bottom
function setupInfiniteScroll() {
  const sentinel = document.querySelector('#infinite-scroll-sentinel');
  if (!sentinel) return;

  if (window.infiniteScrollObserver) {
    window.infiniteScrollObserver.disconnect();
  }

  window.infiniteScrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      const flattenedEvents = [];
      groupedData.forEach(group => {
        group.sources.forEach(src => {
          flattenedEvents.push(...src.items);
        });
      });

      const paginated = paginate(flattenedEvents, pageSize, currentPage);

      if (paginated.length < flattenedEvents.length) {
        currentPage++;
        renderAppContent();
      }
    }
  }, { root: null, rootMargin: '0px', threshold: 1.0 });

  window.infiniteScrollObserver.observe(sentinel);
}

// Filter bar event handler
function handleFilterChange(value, filterKey) {
  switch (filterKey) {
    case 'Expansion':
      currentFilters.expansion = value;
      break;
    case 'Rarity':
      currentFilters.rarity = value;
      break;
    case 'Item Type':
      currentFilters.itemType = value;
      break;
    case 'Guaranteed Only':
      currentFilters.guaranteedOnly = !!value;
      if (currentFilters.guaranteedOnly) currentFilters.chanceOnly = false;
      break;
    case 'Chance Only':
      currentFilters.chanceOnly = !!value;
      if (currentFilters.chanceOnly) currentFilters.guaranteedOnly = false;
      break;
  }
  applyFiltersAndRender(true);
}

// Sort bar handler
function handleSortChange(sortKey) {
  currentSort = sortKey;
  applyFiltersAndRender(false);
}

// Applies filters, re-sorts data, triggers render
function applyFiltersAndRender(resetPage = false) {
  if (resetPage) currentPage = 1;

  filteredEvents = filterEvents(allEvents, currentFilters);

  // Sort logic
  if (currentSort) {
    filteredEvents.sort((a, b) => {
      switch (currentSort) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'map':
          return (a.map || '').localeCompare(b.map || '');
        case 'value':
          const aVal = getMostValuableDrop(a.loot)?.price || 0;
          const bVal = getMostValuableDrop(b.loot)?.price || 0;
          return bVal - aVal;
        default:
          return 0;
      }
    });
  }

  groupedData = groupAndSort(filteredEvents);

  renderAppContent();
}

// Main app render: search, filter, sort, content, infinite scroll
function renderAppContent() {
  const app = document.querySelector('#app');
  if (!app) return;

  app.innerHTML = '';

  app.appendChild(renderSearchBar());
  app.appendChild(renderFilterBar(handleFilterChange));
  app.appendChild(renderSortButtons(handleSortChange));

  const eventsContainer = document.createElement('div');
  eventsContainer.id = 'events-container';
  app.appendChild(eventsContainer);

  // Flatten group for paging
  const flattenedEvents = [];
  groupedData.forEach(group => {
    group.sources.forEach(src => {
      flattenedEvents.push(...src.items);
    });
  });

  const paginated = paginate(flattenedEvents, pageSize, currentPage);
  const pagedGrouped = groupAndSort(paginated);

  const groupedEventsElem = renderEventsGrouped(pagedGrouped);
  eventsContainer.appendChild(groupedEventsElem);

  if (flattenedEvents.length === 0) {
    const noRes = document.createElement('div');
    noRes.className = 'no-results';
    noRes.textContent = 'No events found with this filter.';
    eventsContainer.appendChild(noRes);
  }

  // Infinite scroll sentinel setup
  let sentinel = document.querySelector('#infinite-scroll-sentinel');
  if (sentinel) sentinel.remove();
  sentinel = document.createElement('div');
  sentinel.id = 'infinite-scroll-sentinel';
  sentinel.style.height = '1px';
  app.appendChild(sentinel);

  setupInfiniteScroll();
}

// Export handlers for use in boot and other modules if needed
export {
  handleFilterChange,
  handleSortChange,
  applyFiltersAndRender,
  renderAppContent
};
// --- Copy.js integration for clipboard nudge (global binding) ---
window.copyWithNudge = function(button) {
  const input = button.previousElementSibling;
  if (!input) return;
  const original = button.textContent;
  navigator.clipboard.writeText(input.value).then(() => {
    button.textContent = 'Copied!';
    button.setAttribute('aria-live', 'polite');
    setTimeout(() => {
      button.textContent = original;
      button.removeAttribute('aria-live');
    }, 1000);
  }).catch(() => {
    button.textContent = 'Failed :(';
    setTimeout(() => {
      button.textContent = original;
    }, 1000);
  });
};

// --- Boot Logic ---
async function boot() {
  const terminal = document.querySelector('#terminal');
  if (terminal) {
    terminal.classList.add('matrix-mode');
    terminal.classList.remove('hidden');
    terminal.innerHTML = '';
  }
  console.log('🪛 Starting GW2 Event Loot Browser...');

  try {
    const events = await loadAndEnrichData(ev => {
      if (ev.name) console.log(`Loaded event: ${ev.name} on map ${ev.map}`);
    });

    if (!events.length) {
      console.error('No events loaded - please try again later.');
      if (terminal) {
        terminal.classList.remove('matrix-mode');
        terminal.classList.remove('hidden');
      }
      return;
    }

    allEvents = events;
    currentPage = 1;
    applyFiltersAndRender();

    // Try to scroll to "Core Tyria" section if present
    setTimeout(() => {
      const core = document.querySelector('[data-expansion="Core Tyria"]');
      if (core) core.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 1000);

    // Hide terminal after 3s if there are no error lines
    setTimeout(() => {
      if (terminal) {
        const hasError = !!terminal.querySelector('.terminal-error');
        terminal.classList.remove('matrix-mode');
        if (!hasError) terminal.classList.add('hidden');
      }
    }, 3000);

    console.log(`✅ Loaded ${events.length} events! App is ready.`);
  } catch (e) {
    console.error('🔥 Failed to load and enrich data:', e);
    if (terminal) {
      terminal.classList.remove('matrix-mode');
      terminal.classList.remove('hidden');
    }
  }
}

window.addEventListener('DOMContentLoaded', boot);
