// visual.js
import { loadAndEnrichData } from './infoload.js';
import { filterEvents, fuzzyMatch } from './search.js';
import { paginate } from './pagination.js';
import { groupAndSort } from './data.js';
import { createCopyBar, getMostValuableDrop, createMostValuableBadge } from './copy.js';
import { formatPrice } from './info.js';

// --- Terminal linked console & error output ---
// Override console methods to also append to terminal
function setupConsoleToTerminal() {
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;
  const terminal = document.querySelector('#terminal');

  function appendTerminal(message, type = 'info') {
    if (!terminal) return;
    const line = document.createElement('pre');
    line.className = `terminal-line terminal-${type}`;
    line.textContent = message;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
  }

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

  // Catch global errors and log them
  window.addEventListener('error', e => {
    const msg = `[ERROR] ${e.message} (${e.filename}:${e.lineno})`;
    console.error(msg);
  });
}

setupConsoleToTerminal();

// --- Global state ---
let allEvents = [];            // raw data
let filteredEvents = [];       // filtered data
let groupedData = [];          // grouped by expansion/source
let currentPage = 1;
const pageSize = 20;           // how many events per "page"

// --- Helper: Format copper to "Xg Ys Zc" expanding from info.js ---
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

// --- Description helper: truncate to two full sentences + add (see wiki) ---
function shortenDescription(text, wikiUrl) {
  if (!text) return '';
  // Match first two sentences (ending with ., !, or ?)
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g);
  let shortDesc = '';
  if (sentences && sentences.length >= 2) {
    shortDesc = sentences[0] + ' ' + sentences[1];
  } else {
    shortDesc = text;
  }
  if (wikiUrl) {
    shortDesc += ` (see `;
    shortDesc += `<a href="${wikiUrl}" target="_blank" rel="noopener">wiki</a>)`;
  }
  return shortDesc;
}

// --- Render Functions ---

// Render top horizontal filter bar BELOW search
function renderFilterBar(filters, onChange) {
  const container = document.createElement('div');
  container.className = 'filter-bar';

  // Helper to create select
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

  // Example: expansion filter (Extract unique expansions from allEvents)
  const expansions = [...new Set(allEvents.map(e => e.expansion).filter(Boolean))].sort();
  expansions.unshift(''); // "All"

  container.appendChild(createSelect('Expansion', [{ val: '', text: 'All' }, ...expansions.map(e => ({ val: e, text: e }))], filters.expansion));

  // Rarity filter based on standard GW2 rarities
  const rarities = ['', 'Ascended', 'Exotic', 'Rare', 'Masterwork', 'Fine', 'Basic'];
  container.appendChild(createSelect('Rarity', rarities.map(r => ({ val: r, text: r || 'All' })), filters.rarity));

  // Loot type filter (collect unique types)
  const allTypes = new Set();
  allEvents.forEach(e => {
    (e.loot || []).forEach(l => {
      if (l.type) allTypes.add(l.type);
    });
  });
  const typeOptions = ['', ...Array.from(allTypes).sort()];
  container.appendChild(createSelect('Item Type', typeOptions.map(t => ({ val: t, text: t || 'All' })), filters.itemType));

  // Guaranteed Only checkbox
  const guaranteedWrap = document.createElement('label');
  guaranteedWrap.className = 'filter-checkbox';
  const guaranteedInput = document.createElement('input');
  guaranteedInput.type = 'checkbox';
  guaranteedInput.checked = !!filters.guaranteedOnly;
  guaranteedInput.addEventListener('change', e => onChange(e.target.checked, 'Guaranteed Only'));
  guaranteedWrap.appendChild(guaranteedInput);
  guaranteedWrap.appendChild(document.createTextNode(' Guaranteed Only'));
  container.appendChild(guaranteedWrap);

  // Chance Only checkbox
  const chanceWrap = document.createElement('label');
  chanceWrap.className = 'filter-checkbox';
  const chanceInput = document.createElement('input');
  chanceInput.type = 'checkbox';
  chanceInput.checked = !!filters.chanceOnly;
  chanceInput.addEventListener('change', e => onChange(e.target.checked, 'Chance Only'));
  chanceWrap.appendChild(chanceInput);
  chanceWrap.appendChild(document.createTextNode(' Chance Only'));
  container.appendChild(chanceWrap);

  return container;
}

// Render the event loot list grouped by expansion then source with infinite scroll
function renderEventsGrouped(eventsGrouped) {
  const container = document.createElement('div');
  container.className = 'grouped-events';

  eventsGrouped.forEach(({ expansion, sources }) => {
    const expSection = document.createElement('section');
    expSection.className = 'expansion-group';

    const expTitle = document.createElement('h2');
    expTitle.textContent = expansion;
    expSection.appendChild(expTitle);

    sources.forEach(({ sourcename, items }) => {
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

// Create Event Card with all features
function createEventCard(event) {
  const card = document.createElement('article');
  card.className = 'event-card';

  // Header with clickable wiki link & short description
  const title = document.createElement('h4');
  const titleLink = document.createElement('a');
  titleLink.href = event.wikiLink || '#';
  titleLink.target = '_blank';
  titleLink.rel = 'noopener';
  titleLink.textContent = event.name || 'Unknown Event';
  title.appendChild(titleLink);

  // Description shortened plus see wiki link
  if (event.description) {
    const desc = document.createElement('p');
    desc.className = 'event-desc';
    desc.innerHTML = shortenDescription(event.description, event.wikiLink);
    card.appendChild(title);
    card.appendChild(desc);
  } else {
    card.appendChild(title);
  }

  // Event meta info: Map link and waypoint link
  const meta = document.createElement('p');
  meta.className = 'event-meta';

  meta.innerHTML =
    `<b>Map:</b> <a href="${event.mapWikiLink || '#'}" target="_blank" rel="noopener">${event.map || '?'}</a>` +
    ` | <b>Waypoint:</b> ${event.waypointName ? `<a href="${event.waypointWikiLink}" target="_blank" rel="noopener">${event.waypointName}</a>` : event.code || '-'}`;
  card.appendChild(meta);

  // Loot list
  if (event.loot && event.loot.length) {
    const lootUl = document.createElement('ul');
    lootUl.className = 'loot-list';

    // Sort loot - most valuable drops (price) on top
    const sortedLoot = [...event.loot].sort((a, b) => {
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return b.price - a.price;
    });

    const mostValuable = getMostValuableDrop(event.loot) || null;
    sortedLoot.forEach(item => {
      const li = document.createElement('li');
      li.className = 'loot-item';
      if (item === mostValuable) li.classList.add('most-valuable');

      // icon + name with link
      const iconImg = item.icon
        ? `<img src="${item.icon}" alt="${item.name} icon" class="loot-icon"/> `
        : '';

      const wikiLink = item.wikiLink || '#';
      const priceStr = formatCopper(item.price);
      const vendorStr = item.vendorValue != null ? `Vendor: ${formatCopper(item.vendorValue)}` : '';
      const accBound = item.accountBound ? 'Accountbound' : '';

      const metaStrings = [priceStr, vendorStr, accBound].filter(Boolean);
      const metaText = metaStrings.length ? ` (${metaStrings.join(', ')})` : '';

      li.innerHTML = `${iconImg}<a href="${wikiLink}" target="_blank" rel="noopener">${item.name}</a>${metaText}`;

      if (item.guaranteed) {
        li.innerHTML += ` <span class="loot-guaranteed" title="Guaranteed drop">[Guaranteed]</span>`;
      }
      if (item === mostValuable) {
        li.innerHTML += createMostValuableBadge(item);
      }

      lootUl.appendChild(li);
    });
    card.appendChild(lootUl);
  }

  // Copy bar at bottom
  card.insertAdjacentHTML('beforeend', createCopyBar(event));

  return card;
}

// --- Rendering and Event Handlers ---

// State for filters
let currentFilters = {
  searchTerm: '',
  expansion: '',
  rarity: '',
  itemType: '',
  guaranteedOnly: false,
  chanceOnly: false
};

function handleFilterChange(value, filterKey) {
  switch (filterKey) {
    case 'Expansion': currentFilters.expansion = value; break;
    case 'Rarity': currentFilters.rarity = value; break;
    case 'Item Type': currentFilters.itemType = value; break;
    case 'Guaranteed Only': currentFilters.guaranteedOnly = Boolean(value); break;
    case 'Chance Only': currentFilters.chanceOnly = Boolean(value); break;
  }
  applyFiltersAndRender(true);
}

function applyFiltersAndRender(resetPage = false) {
  if (resetPage) currentPage = 1;

  // Apply filters including searchTerm via search.js
  filteredEvents = filterEvents(allEvents, currentFilters);

  // Group filtered events by expansion/source
  groupedData = groupAndSort(filteredEvents);

  renderAppContent();
}

// Render the page content with infinite scroll:
function renderAppContent() {
  const app = document.querySelector('#app');
  const terminal = document.querySelector('#terminal');
  if (!app || !terminal) return;

  app.innerHTML = ''; // clear app content

  // Search bar on top
  const searchWrap = document.createElement('div');
  searchWrap.className = 'search-bar';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search events or maps...';
  searchInput.autocomplete = 'off';
  searchInput.value = currentFilters.searchTerm;
  searchInput.setAttribute('aria-label', 'Search events or maps');

  searchInput.addEventListener('input', e => {
    currentFilters.searchTerm = e.target.value;
    applyFiltersAndRender(true);
  });
  searchWrap.appendChild(searchInput);
  app.appendChild(searchWrap);

  // Filter bar below search, only if data loaded
  if (allEvents.length) {
    const filterBar = renderFilterBar(currentFilters, handleFilterChange);
    app.appendChild(filterBar);
  }

  // Container for event list
  const eventsContainer = document.createElement('div');
  eventsContainer.id = 'events-container';
  app.appendChild(eventsContainer);

  // Flatten grouped data back to event list for pagination and infinite scroll
  const flattenedEvents = [];
  groupedData.forEach(group => {
    group.sources.forEach(src => {
      flattenedEvents.push(...src.items);
    });
  });

  // Paginate flattened filtered results:
  const paginated = paginate(flattenedEvents, pageSize, currentPage);

  // Regroup paginated again for display
  const pagedGrouped = groupAndSort(paginated);

  // Render grouped events slice
  const groupedEventsElem = renderEventsGrouped(pagedGrouped);
  eventsContainer.appendChild(groupedEventsElem);

  // No Results message
  if (flattenedEvents.length === 0) {
    const noRes = document.createElement('div');
    noRes.className = 'no-results';
    noRes.textContent = 'No events found with this filter.';
    eventsContainer.appendChild(noRes);
  }

  // Infinite scroll setup:
  const options = {
    root: null,
    rootMargin: '0px',
    threshold: 1.0
  };

  // Remove existing observer first if any
  if (window.infiniteScrollObserver) {
    window.infiniteScrollObserver.disconnect();
  }

  // Create sentinel at bottom to trigger load more
  let sentinel = document.querySelector('#infinite-scroll-sentinel');
  if (sentinel) sentinel.remove();
  sentinel = document.createElement('div');
  sentinel.id = 'infinite-scroll-sentinel';
  sentinel.style.height = '1px';
  app.appendChild(sentinel);

  window.infiniteScrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      if (paginated.length < flattenedEvents.length) {
        currentPage++;
        renderAppContent();
      }
    }
  }, options);

  window.infiniteScrollObserver.observe(sentinel);
}

// --- Bootstrapping and Data Loading ---

async function boot() {
  console.log('🪛 Starting GW2 Event Loot Browser...');
  const terminal = document.querySelector('#terminal');
  if (terminal) terminal.textContent = '';

  try {
    const events = await loadAndEnrichData(ev => {
      if (ev.name) console.log(`Loaded event: ${ev.name} on map ${ev.map}`);
    });

    if (!events.length) {
      console.error('No events loaded - please try again later.');
      return;
    }

    allEvents = events;
    currentPage = 1;
    applyFiltersAndRender();

    console.log(`✅ Loaded ${events.length} events! App is ready.`);
  } catch (e) {
    console.error('🔥 Failed to load and enrich data:', e);
  }
}

window.addEventListener('DOMContentLoaded', boot);

// --- Copy.js functions - fully implemented here ---

window.copyWithNudge = function(button) {
  const input = button.previousElementSibling;
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => {
    const original = button.textContent;
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

export { // All exports from copy.js for comprehensive use
  getMostValuableDrop,
  createCopyBar,
  createMostValuableBadge
};
