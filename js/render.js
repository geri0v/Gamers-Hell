import { loadAndEnrichData } from 'https://geri0v.github.io/Gamers-Hell/js/infoload.js';
import { groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/info.js';
import {
  createCopyBar,
  createMostValuableBadge,
  getMostValuableDrop
} from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';
import { setupToggles } from 'https://geri0v.github.io/Gamers-Hell/js/toggle.js';
import { filterEvents } from 'https://geri0v.github.io/Gamers-Hell/js/search.js';
import { paginate } from 'https://geri0v.github.io/Gamers-Hell/js/pagination.js';

let allData = [];
let currentPage = 1;
let isLoading = false;
let columnSort = {};
let compactLootLayout = false;
const PAGE_SIZE = 20;
const renderedSet = new Set();

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

function renderProgressBar(percent) {
  return `<div class="progress-bar-container"><div class="progress-bar" style="width:${percent}%;"></div></div>`;
}

function maxPriceFromLoot(loot = []) {
  return Math.max(...loot.map(l => l.price ?? 0));
}

function getFiltersFromUI() {
  return {
    searchTerm: document.getElementById('search-input').value,
    expansion: document.getElementById('expansion-filter').value,
    rarity: document.getElementById('rarity-filter').value,
    lootName: document.getElementById('lootname-filter').value,
    itemType: document.getElementById('loottype-filter').value,
    vendorValueMin: Number(document.getElementById('vendormin-filter').value) || undefined,
    vendorValueMax: Number(document.getElementById('vendormax-filter').value) || undefined,
    chatcode: document.getElementById('chatcode-filter').value,
    guaranteedOnly: document.getElementById('guaranteedonly-filter').checked,
    chanceOnly: document.getElementById('chanceonly-filter').checked,
    sortKey: document.getElementById('sort-filter').value
  };
}

function renderSearchUI() {
  return `
    <div id="main-controls-wrap">
      <div class="toolbar-top">
        <button class="side-btn" id="side-help" aria-label="Help">❓</button>
        <button class="side-btn" id="toggle-compact" aria-label="Toggle layout">🗂️</button>
        <input id="search-input" aria-label="Search" placeholder="Search event or map..." style="flex: 1; min-width: 280px; padding: 0.5em 0.8em; font-size: 1em; border-radius: 5px; border: 1px solid #bbb;">
      </div>
      <div class="search-grid">
        <input id="lootname-filter" placeholder="Loot name" />
        <input id="loottype-filter" placeholder="Type" />
        <input id="chatcode-filter" placeholder="Chatcode" />
        <select id="expansion-filter"><option value="">All Expansions</option></select>
        <select id="rarity-filter">
          <option value="">All Rarities</option>
          <option>Ascended</option><option>Exotic</option><option>Rare</option>
          <option>Masterwork</option><option>Fine</option><option>Basic</option>
        </select>
        <input id="vendormin-filter" type="number" placeholder="Min vendor" />
        <input id="vendormax-filter" type="number" placeholder="Max vendor" />
        <label><input type="checkbox" id="guaranteedonly-filter" /> Guaranteed</label>
        <label><input type="checkbox" id="chanceonly-filter" /> Chance</label>
        <select id="sort-filter">
          <option value="">Sort By</option>
          <option value="name">Name</option>
          <option value="expansion">Expansion</option>
          <option value="map">Map</option>
          <option value="code">WP Code</option>
          <option value="waypointName">WP Name</option>
          <option value="value">Value</option>
        </select>
      </div>
    </div>
  `;
}

function renderLootCards(loot, eventId) {
  if (!Array.isArray(loot) || loot.length === 0) return '';
  const lootId = `loot-${eventId}`;
  const mostVal = getMostValuableDrop(loot);
  return `
    <button class="toggle-btn" data-target="${lootId}" aria-expanded="false">Show</button>
    <div class="subcards${compactLootLayout ? ' compact' : ''} hidden" id="${lootId}">
      ${loot.map(l => `
        <div class="subcard${l.guaranteed ? ' guaranteed' : ''}${l === mostVal ? ' most-valuable' : ''}">
          ${l.icon ? `<img src="${l.icon}" alt="" style="height:1.2em;width:auto;vertical-align:middle;margin-right:0.3em;">` : ''}
          ${l.wikiLink ? `<a href="${l.wikiLink}" target="_blank">${l.name}</a>` : l.name}
          ${l.price != null ? `<div><strong>Price:</strong> ${formatPrice(l.price)}</div>` : ''}
          ${l.vendorValue != null ? `<div><strong>Vendor:</strong> ${formatPrice(l.vendorValue)}</div>` : ''}
          ${l.chatCode ? `<div><strong>Chatcode:</strong> ${l.chatCode}</div>` : ''}
          ${l.accountBound ? `<div><strong>Bound:</strong> Yes</div>` : ''}
          ${l.guaranteed ? '<div class="guaranteed-badge">Guaranteed</div>' : ''}
          ${l === mostVal ? createMostValuableBadge(l) : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderEventTable(events, srcIdx, expIdx) {
  return `
    <table class="event-table">
      <thead>
        <tr>
          <th data-sort-key="name">Name</th>
          <th data-sort-key="map">Map</th>
          <th data-sort-key="waypointName">WP Name</th>
          <th data-sort-key="code">WP Code</th>
        </tr>
      </thead>
      <tbody>
        ${events.map((e, idx) => {
          const eventId = `ev${expIdx}-${srcIdx}-${idx}`;
          e.value = maxPriceFromLoot(e.loot);

          // Info row: Name | Map (with wiki) | Waypoint Name | Waypoint Code
          return `
            <tr id="${eventId}">
              <td><a href="#${eventId}">${e.name}</a></td>
              <td>${e.mapWikiLink ? `<a href="${e.mapWikiLink}" target="_blank">${e.map}</a>` : e.map}</td>
              <td>${e.waypointName || '–'}</td>
              <td>${e.code || '–'}</td>
            </tr>
            <tr>
              <td colspan="4">${createCopyBar(e)}</td>
            </tr>
            <tr>
              <td colspan="4">
                ${e.description ? `<div class="inline-desc"><strong>Description:</strong> ${e.description}</div>` : ''}
              </td>
            </tr>
            <tr>
              <td colspan="4">${renderLootCards(e.loot, eventId)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function updateExpansionOptions(events) {
  const exps = [...new Set(events.map(e => e.expansion))].sort();
  const select = document.getElementById('expansion-filter');
  select.innerHTML = `<option value="">All Expansions</option>` + exps.map(e => `<option>${e}</option>`).join('');
}

function applyFiltersAndRender(container, data, page = 1, append = false) {
  const filters = getFiltersFromUI();
  let filtered = filterEvents(data, filters);

  // Enhanced sorting
  if (filters.sortKey) {
    filtered = filtered.slice().sort((a, b) => {
      if (filters.sortKey === "value")
        return (b.value || 0) - (a.value || 0);
      if (filters.sortKey === "waypointName")
        return (a.waypointName || '').localeCompare(b.waypointName || '');
      if (filters.sortKey === "code")
        return (a.code || '').localeCompare(b.code || '');
      return (a[filters.sortKey] || '').localeCompare(b[filters.sortKey] || '');
    });
  }

  const paged = paginate(filtered, PAGE_SIZE, page);
  const grouped = groupAndSort(paged);

  if (!append) container.innerHTML = '';
  if (!grouped.length) {
    container.innerHTML = '<div class="no-results">No results found.</div>';
    return;
  }

  grouped.forEach((exp, expIdx) => {
    const expCard = createCard('expansion-card', `
      <button class="toggle-btn" data-target="exp-${expIdx}">Toggle</button>
      <h2>${exp.expansion}</h2>
      <div class="expansion-content" id="exp-${expIdx}"></div>
    `);
    exp.sources.forEach((src, srcIdx) => {
      const srcTable = renderEventTable(src.items, srcIdx, expIdx);
      const srcCard = createCard('source-card', `
        <button class="toggle-btn" data-target="src-${expIdx}-${srcIdx}">Toggle</button>
        <h3>${src.sourcename}</h3>
        <div id="src-${expIdx}-${srcIdx}" class="source-content">${srcTable}</div>
      `);
      expCard.querySelector('.expansion-content').appendChild(srcCard);
    });
    container.appendChild(expCard);
  });

  setupToggles();
  container.querySelectorAll('th[data-sort-key]').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.sortKey;
      let dir = 'asc';
      if (columnSort.key === key && columnSort.dir === 'asc') dir = 'desc';
      columnSort = { key, dir };
      applyFiltersAndRender(container, allData, 1);
    };
  });
}

export async function renderApp(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = renderProgressBar(10) + "<div>Loading...</div>";

  allData = await loadAndEnrichData(evt => {
    const bar = document.querySelector('.progress-bar');
    if (bar) bar.style.width = '80%';
  });

  el.innerHTML = renderSearchUI() + `<div id="events-list"></div>`;
  const list = document.getElementById('events-list');
  updateExpansionOptions(allData);
  applyFiltersAndRender(list, allData, 1);

  [
    'search-input', 'expansion-filter', 'rarity-filter', 'lootname-filter',
    'loottype-filter', 'vendormin-filter', 'vendormax-filter',
    'chatcode-filter', 'guaranteedonly-filter', 'chanceonly-filter', 'sort-filter'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      currentPage = 1;
      renderedSet.clear();
      applyFiltersAndRender(list, allData, 1);
    });
  });

  document.getElementById('toggle-compact').onclick = () => {
    compactLootLayout = !compactLootLayout;
    applyFiltersAndRender(list, allData, 1);
  };

  // Modal help
  document.getElementById('side-help').onclick = () => {
    if (document.getElementById('modal-help')) return;
    const modal = document.createElement('div');
    modal.id = 'modal-help';
    modal.style = `
      position:fixed;inset:0;background:#0006;display:flex;
      align-items:center;justify-content:center;z-index:9999;
    `;
    modal.innerHTML = `
      <div class="modal-content">
        <h2>How to Use</h2>
        <ul>
          <li>Use filters and search bar to search &amp; sort</li>
          <li>Click on loot name or code to visit wiki</li>
          <li>Copy event data with the Copy button</li>
          <li>Click 🗂️ to toggle loot layout</li>
        </ul>
      </div>`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
    setTimeout(() => { modal.focus(); }, 250);
  };

  // Infinite scroll with anti-repeat check
  window.addEventListener('scroll', () => {
    if (isLoading) return;
    const bottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 120;
    const filters = getFiltersFromUI();
    const filtered = filterEvents(allData, filters);
    const nextPageEvents = paginate(filtered, PAGE_SIZE, currentPage + 1);
    const alreadyHasAll = nextPageEvents.every(ev => renderedSet.has(ev.name));
    if (bottom && alreadyHasAll === false && nextPageEvents.length > PAGE_SIZE * currentPage) {
      isLoading = true;
      currentPage++;
      nextPageEvents.forEach(ev => renderedSet.add(ev.name));
      applyFiltersAndRender(list, allData, currentPage, true);
      isLoading = false;
    }
  });
}

// Auto run
renderApp('app');
