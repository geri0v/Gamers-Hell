// Gamers-Hell: Enhanced JS for Dynamic Loading, Prioritized API Usage, and Smart Caching

const DATA_URLS = [
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
];

const OTC_CSV_URL = 'https://raw.githubusercontent.com/otc-cirdan/gw2-items/master/items.csv';

let allEvents = [];
let filteredEvents = [];
let sortKey = 'name';
let sortAsc = true;

const itemCache = {};    // Cache for item info keyed by item ID or code
const priceCache = {};   // Cache for TP prices keyed by item ID
const otcCsvCache = {};  // Cache for OTC CSV items keyed by ID, name, or chatcode

// Track expanded expansions and sources for dynamic loading/deloading
const expandedExpansions = new Set();
const expandedSources = new Set();

// Spinner control
function showSpinner(container) {
  container.innerHTML = '<div class="spinner" role="status" aria-live="polite" aria-label="Loading"></div>';
}
function hideSpinner(container) {
  container.innerHTML = '';
}

// Load OTC CSV once and cache
async function loadOtcCsv() {
  if (Object.keys(otcCsvCache).length > 0) return;
  try {
    const res = await fetch(OTC_CSV_URL);
    const text = await res.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      if (row.length !== headers.length) continue;
      const obj = {};
      headers.forEach((h, idx) => obj[h.trim()] = row[idx]?.trim());
      if (obj.id) otcCsvCache[obj.id] = obj;
      if (obj.name) otcCsvCache[obj.name.toLowerCase()] = obj;
      if (obj.chatcode) otcCsvCache[obj.chatcode] = obj;
    }
  } catch (e) {
    console.warn("Failed to load OTC CSV:", e);
  }
}

// Helper: Create Wiki URL for an item
function createWikiUrl(item) {
  if (!item) return '#';
  if (item.id && itemCache[item.id] && itemCache[item.id].name) {
    return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(itemCache[item.id].name.replace(/ /g, '_'))}`;
  }
  if (item.name) {
    return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(item.name.replace(/ /g, '_'))}`;
  }
  if (item.code && item.code.startsWith('[&')) {
    return `https://wiki.guildwars2.com/wiki/Special:Search?search=${encodeURIComponent(item.code)}`;
  }
  if (item.id) {
    return `https://wiki.guildwars2.com/wiki/Special:Search?search=${encodeURIComponent(item.id)}`;
  }
  return '#';
}

// Helper: Format GW2 currency from copper units
function formatCurrency(copper) {
  if (typeof copper !== 'number' || isNaN(copper)) return '';
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperRemainder = copper % 100;
  let str = '';
  if (gold) str += `${gold}g `;
  if (gold || silver) str += `${silver}s `;
  str += `${copperRemainder}c`;
  return str.trim();
}

// Fetch item info prioritized: API -> OTC CSV fallback
async function fetchItemInfo(item) {
  if (!item) return null;
  const key = item.id || item.code || item.name;
  if (itemCache[key]) return itemCache[key];

  // Try official API first
  if (item.id) {
    try {
      const res = await fetch(`https://api.guildwars2.com/v2/items/${item.id}`);
      if (res.ok) {
        const data = await res.json();
        const info = {
          id: item.id,
          name: data.name,
          vendor_value: data.vendor_value,
          chat_link: data.chat_link,
          icon: data.icon,
          accountbound: data.flags?.includes('AccountBound') || data.flags?.includes('AccountBoundOnUse'),
          wiki: createWikiUrl({ id: item.id }),
        };
        itemCache[key] = info;
        return info;
      }
    } catch (e) {
      // API fetch failed, continue to fallback
    }
  }

  // Try OTC CSV fallback
  await loadOtcCsv();
  let otc = null;
  if (item.code && otcCsvCache[item.code]) otc = otcCsvCache[item.code];
  if (!otc && item.name && otcCsvCache[item.name.toLowerCase()]) otc = otcCsvCache[item.name.toLowerCase()];
  if (!otc && item.id && otcCsvCache[item.id]) otc = otcCsvCache[item.id];
  if (otc) {
    const info = {
      id: item.id || otc.id,
      name: otc.name,
      vendor_value: otc.vendor_value ? parseInt(otc.vendor_value) : undefined,
      chat_link: otc.chatcode,
      icon: otc.icon,
      accountbound: otc.bound === 'AccountBound',
      wiki: createWikiUrl({ name: otc.name }),
    };
    itemCache[key] = info;
    return info;
  }

  // Last fallback: minimal info
  const fallbackInfo = {
    id: item.id || null,
    name: item.name || item.code || 'Unknown Item',
    vendor_value: 0,
    chat_link: '',
    icon: '',
    accountbound: false,
    wiki: createWikiUrl(item),
  };
  itemCache[key] = fallbackInfo;
  return fallbackInfo;
}

// Fetch TP prices prioritized: API -> BLTC fallback
async function fetchTpPrice(itemId) {
  if (!itemId) return null;
  if (priceCache[itemId] !== undefined) return priceCache[itemId];

  // Official API
  try {
    const res = await fetch(`https://api.guildwars2.com/v2/commerce/prices/${itemId}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.sells && typeof data.sells.unit_price === 'number') {
        priceCache[itemId] = data.sells.unit_price;
        return priceCache[itemId];
      }
    }
  } catch (e) {
    // Continue to fallback
  }

  // BLTC fallback
  try {
    const res = await fetch(`https://api.gw2bltc.com/price/${itemId}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.sell === 'number') {
        priceCache[itemId] = data.sell;
        return priceCache[itemId];
      }
    }
  } catch (e) {
    // No further fallback
  }

  priceCache[itemId] = null;
  return null;
}

// Load all event data from JSON sources
async function loadEventData() {
  const allData = await Promise.all(DATA_URLS.map(async url => {
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json;
    } catch (e) {
      console.warn(`Failed to load JSON from ${url}`, e);
      return null;
    }
  }));
  return allData.filter(Boolean);
}

// Render expansions and sources menu dynamically
function renderMenu(menuStructure) {
  if (typeof window.renderMenu === 'function') {
    window.renderMenu(menuStructure);
  }
}

// Render event cards for a given expansion and source
async function renderEventsForSource(expansion, source, container) {
  container.innerHTML = '';
  showSpinner(container);

  // Filter events for this expansion and source
  const events = filteredEvents.filter(ev =>
    ev.expansion === expansion && ev.sourceName === source
  );

  // Load item info and prices for all loot items in these events
  const itemIdsToFetch = new Set();
  events.forEach(ev => {
    (ev.loot || []).forEach(item => {
      if (item.id) itemIdsToFetch.add(item.id);
    });
  });

  // Fetch item info and prices sequentially with caching
  await Promise.all(Array.from(itemIdsToFetch).map(async id => {
    await fetchItemInfo({ id });
    await fetchTpPrice(id);
  }));

  // Build event cards HTML
  const cardsHtml = events.map(ev => {
    const lootHtml = (ev.loot || []).map(item => {
      const info = itemCache[item.id] || {};
      const price = priceCache[item.id];
      const priceStr = price ? formatCurrency(price) : '';
      return `
        <li>
          <img src="${info.icon || ''}" alt="" class="loot-icon" />
          <a href="${info.wiki || '#'}" target="_blank" rel="noopener noreferrer">${info.name || item.name || 'Unknown'}</a>
          <span class="vendor-value">${priceStr}</span>
        </li>
      `;
    }).join('');

    const copyText = `${ev.name} | ${ev.code || ''} | ${(ev.loot || []).map(i => i.name).join(', ')}`;

    return `
      <article class="event-card fullwidth-event-card">
        <div class="card-header">
          <h2>${ev.name}</h2>
        </div>
        <div class="card-body">
          <div class="event-info">
            <span><b>Location:</b> ${ev.map || ''}</span>
            <span><b>Waypoint:</b> ${ev.code || ''}</span>
          </div>
          <div class="copy-bar" style="position:relative;">
            <input type="text" value="${copyText}" readonly />
            <button class="copy-btn" type="button">Copy</button>
          </div>
          <button class="show-hide-toggle" type="button" aria-expanded="false">Show Loot ▼</button>
          <ul class="loot-list copy-paste-area" style="display:none;">
            ${lootHtml}
          </ul>
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = cardsHtml;

  // Attach event listeners for copy buttons and loot toggles
  container.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      input.select();
      document.execCommand('copy');
      showCopyNudge(btn);
    });
  });

  container.querySelectorAll('.show-hide-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const lootList = btn.nextElementSibling;
      const expanded = lootList.style.display === 'block';
      lootList.style.display = expanded ? 'none' : 'block';
      btn.textContent = expanded ? 'Show Loot ▼' : 'Hide Loot ▲';
      btn.setAttribute('aria-expanded', !expanded);
    });
  });
}

// Render expansions and sources with dynamic loading/paging
async function renderExpansions(container) {
  container.innerHTML = '';
  showSpinner(container);

  // Group filtered events by expansion and source
  const expansions = {};
  filteredEvents.forEach(ev => {
    if (!expansions[ev.expansion]) expansions[ev.expansion] = {};
    if (!expansions[ev.expansion][ev.sourceName]) expansions[ev.expansion][ev.sourceName] = [];
    expansions[ev.expansion][ev.sourceName].push(ev);
  });

  // Build expansion list with collapsible sources
  container.innerHTML = Object.entries(expansions).map(([expansion, sources]) => `
    <section class="expansion-section" data-expansion="${expansion}">
      <button class="expansion-toggle" aria-expanded="false">${expansion} ▼</button>
      <div class="sources-container" style="display:none;">
        ${Object.keys(sources).map(source => `
          <div class="source-section" data-source="${source}">
            <button class="source-toggle" aria-expanded="false">${source} ▼</button>
            <div class="events-container" style="display:none;"></div>
          </div>
        `).join('')}
      </div>
    </section>
  `).join('');

  // Attach event listeners for expansion toggles
  container.querySelectorAll('.expansion-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      btn.textContent = expanded ? btn.textContent.replace('▲', '▼') : btn.textContent.replace('▼', '▲');
      const sourcesContainer = btn.nextElementSibling;
      sourcesContainer.style.display = expanded ? 'none' : 'block';
    });
  });

  // Attach event listeners for source toggles with dynamic event loading
  container.querySelectorAll('.source-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      btn.textContent = expanded ? btn.textContent.replace('▲', '▼') : btn.textContent.replace('▼', '▲');
      const eventsContainer = btn.nextElementSibling;

      if (!expanded && eventsContainer.innerHTML.trim() === '') {
        // Load events dynamically for this source
        const sourceSection = btn.closest('.source-section');
        const expansionSection = btn.closest('.expansion-section');
        const expansionName = expansionSection.getAttribute('data-expansion');
        const sourceName = sourceSection.getAttribute('data-source');
        showSpinner(eventsContainer);
        await renderEventsForSource(expansionName, sourceName, eventsContainer);
      }

      eventsContainer.style.display = expanded ? 'none' : 'block';
    });
  });

  hideSpinner(container);
}

// Show copy feedback nudge
function showCopyNudge(btn) {
  const parent = btn.parentElement;
  const existing = parent.querySelector('.copy-nudge');
  if (existing) existing.remove();
  const nudge = document.createElement('span');
  nudge.className = 'copy-nudge';
  nudge.textContent = 'Copied!';
  parent.appendChild(nudge);
  setTimeout(() => nudge.remove(), 1200);
}

// Search and sort filtering
function applyFilters() {
  const query = document.getElementById('search').value.trim().toLowerCase();
  filteredEvents = allEvents.filter(ev => {
    if (query === '') return true;
    if ((ev.name && ev.name.toLowerCase().includes(query)) ||
        (ev.map && ev.map.toLowerCase().includes(query)) ||
        (ev.loot && ev.loot.some(item => item.name && item.name.toLowerCase().includes(query)))) {
      return true;
    }
    return false;
  });

  filteredEvents.sort((a, b) => {
    let vA = a[sortKey] || '';
    let vB = b[sortKey] || '';
    if (typeof vA === 'string') vA = vA.toLowerCase();
    if (typeof vB === 'string') vB = vB.toLowerCase();
    if (vA < vB) return sortAsc ? -1 : 1;
    if (vA > vB) return sortAsc ? 1 : -1;
    return 0;
  });

  const container = document.getElementById('events');
  renderExpansions(container);
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('events');
  showSpinner(container);

  // Load all event JSON data
  const loadedJsons = await loadEventData();

  // Flatten all events with sourceName and expansion
  allEvents = [];
  loadedJsons.forEach(json => {
    const sourceName = json.sourceName || 'Unknown Source';
    if (Array.isArray(json.events)) {
      json.events.forEach(ev => {
        ev.sourceName = sourceName;
        allEvents.push(ev);
      });
    }
  });

  filteredEvents = allEvents;

  // Initial render
  renderMenu(getMenuStructure());
  applyFilters();

  // Setup search input listener
  document.getElementById('search').addEventListener('input', () => {
    applyFilters();
  });

  // Setup sort buttons listener
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newSortKey = btn.dataset.sort;
      if (sortKey === newSortKey) sortAsc = !sortAsc;
      else {
        sortKey = newSortKey;
        sortAsc = true;
      }
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });
});

// Expose filtering for menu.js integration
window.cmd_run = function(cmdString) {
  const expSrcMatch = cmdString.match(/^show expansion "(.+)" source "(.+)"$/i);
  if (expSrcMatch) {
    const [, exp, src] = expSrcMatch;
    filteredEvents = allEvents.filter(ev => ev.expansion === exp && ev.sourceName === src);
    renderExpansions(document.getElementById('events'));
    return;
  }
  const expMatch = cmdString.match(/^show expansion "(.+)"$/i);
  if (expMatch) {
    const [, exp] = expMatch;
    filteredEvents = allEvents.filter(ev => ev.expansion === exp);
    renderExpansions(document.getElementById('events'));
    return;
  }
  const srcMatch = cmdString.match(/^show source "(.+)"$/i);
  if (srcMatch) {
    const [, src] = srcMatch;
    filteredEvents = allEvents.filter(ev => ev.sourceName === src);
    renderExpansions(document.getElementById('events'));
    return;
  }
  if (/^show all$/i.test(cmdString)) {
    filteredEvents = allEvents;
    renderExpansions(document.getElementById('events'));
    return;
  }
  alert(`Unknown command: ${cmdString}`);
};
