import { loadAndEnrichData } from './infoload.js';
import { groupAndSort } from './data.js';
import { formatPrice } from './info.js';
import {
  createCopyBar,
  createMostValuableBadge,
  getMostValuableDrop
} from './copy.js';
import { filterEvents } from './search.js';
import { paginate } from './pagination.js';

let allData = [];
let currentPage = 1;
let isLoading = false;
let columnSort = {};
const PAGE_SIZE = 20;

const renderedSet = new Set();

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

function renderToolbar() {
  return `
    <div id="main-controls-wrap">
      <div class="toolbar-top">
        <button class="side-btn" id="side-help" aria-label="Help">❓</button>
        <input id="search-input" aria-label="Search" placeholder="Search event or map..." />
      </div>
      <div class="filter-row">
        <input id="lootname-filter" placeholder="Loot name" />
        <input id="loottype-filter" placeholder="Type" />
        <input id="chatcode-filter" placeholder="Chatcode" />
        <input id="minprice-filter" type="number" placeholder="Min price" />
        <input id="maxprice-filter" type="number" placeholder="Max price" />
        <input id="vendormin-filter" type="number" placeholder="Min vendor" />
        <input id="vendormax-filter" type="number" placeholder="Max vendor" />
      </div>
      <div class="filter-row">
        <select id="sort-filter">
          <option value="">Sort By</option>
          <option value="name">Name</option>
          <option value="map">Map</option>
          <option value="waypointName">WP Name</option>
          <option value="code">WP Code</option>
          <option value="value">Highest Value</option>
        </select>
        <select id="expansion-filter"><option value="">All Expansions</option></select>
        <select id="rarity-filter">
          <option value="">All Rarities</option>
          <option>Ascended</option><option>Exotic</option><option>Rare</option>
          <option>Masterwork</option><option>Fine</option><option>Basic</option>
        </select>
        <label><input type="checkbox" id="guaranteedonly-filter" /> Guaranteed</label>
        <label><input type="checkbox" id="chanceonly-filter" /> Chance</label>
      </div>
    </div>
  `;
}

function getFiltersFromUI() {
  return {
    searchTerm: document.getElementById('search-input').value,
    lootName: document.getElementById('lootname-filter').value,
    itemType: document.getElementById('loottype-filter').value,
    chatcode: document.getElementById('chatcode-filter').value,
    vendorValueMin: Number(document.getElementById('vendormin-filter').value) || undefined,
    vendorValueMax: Number(document.getElementById('vendormax-filter').value) || undefined,
    minprice: Number(document.getElementById('minprice-filter').value) || undefined,
    maxprice: Number(document.getElementById('maxprice-filter').value) || undefined,
    guaranteedOnly: document.getElementById('guaranteedonly-filter').checked,
    chanceOnly: document.getElementById('chanceonly-filter').checked,
    sortKey: document.getElementById('sort-filter').value,
    expansion: document.getElementById('expansion-filter').value,
    rarity: document.getElementById('rarity-filter').value
  };
}

function renderLootCards(loot, eventId) {
  if (!loot || !loot.length) return '';
  const mostVal = getMostValuableDrop(loot);
  return `
    <div class="subcards" id="loot-${eventId}">
      ${loot.map(l => `
        <div class="subcard${l.guaranteed ? ' guaranteed' : ''}${l === mostVal ? ' most-valuable' : ''}">
          ${l.icon ? `<img src="${l.icon}" alt="" />` : ''}
          ${l.wikiLink ? `<a href="${l.wikiLink}" target="_blank">${l.name}</a>` : l.name}
          ${l.price != null ? `<div><strong>Price:</strong> ${formatPrice(l.price)}</div>` : ''}
          ${l.vendorValue ? `<div><strong>Vendor:</strong> ${formatPrice(l.vendorValue)}</div>` : ''}
          ${l.chatCode ? `<div><strong>Chatcode:</strong> ${l.chatCode}</div>` : ''}
          ${l.accountBound ? '<div><strong>Bound:</strong> Yes</div>' : ''}
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
          const eventId = `ev-${expIdx}-${srcIdx}-${idx}`;
          e.value = maxPriceFromLoot(e.loot);
          return `
            <tr id="${eventId}">
              <td><a href="${e.wikiLink}" target="_blank">${e.name}</a></td>
              <td>${e.mapWikiLink ? `<a href="${e.mapWikiLink}" target="_blank">${e.map}</a>` : e.map}</td>
              <td>${e.waypointName && e.waypointWikiLink ? `<a href="${e.waypointWikiLink}" target="_blank">${e.waypointName}</a>` : (e.waypointName || '–')}</td>
              <td>${e.code || '–'}</td>
            </tr>
            <tr><td colspan="4">${createCopyBar(e)}</td></tr>
            <tr><td colspan="4">
              ${e.description ? `<div class="inline-desc"><strong>Description:</strong> ${e.description}</div>` : ''}
            </td></tr>
            <tr><td colspan="4">${renderLootCards(e.loot, eventId)}</td></tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function maxPriceFromLoot(loot = []) {
  return Math.max(...loot.map(l => l.price ?? 0));
}

function updateExpansionOptions(events) {
  const exps = [...new Set(events.map(e => e.expansion))].sort();
  const select = document.getElementById("expansion-filter");
  select.innerHTML = `<option value="">All Expansions</option>` + exps.map(e => `<option>${e}</option>`).join('');
}

function applyFiltersAndRender(container, data, page = 1, append = false) {
  const filters = getFiltersFromUI();
  let filtered = filterEvents(data, filters);

  if (filters.minprice !== undefined) {
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => l.price >= filters.minprice)
    );
  }
  if (filters.maxprice !== undefined) {
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => l.price <= filters.maxprice)
    );
  }

  if (filters.sortKey) {
    filtered = filtered.sort((a, b) => {
      if (filters.sortKey === 'value') return (b.value || 0) - (a.value || 0);
      return (a[filters.sortKey] || '').localeCompare(b[filters.sortKey] || '');
    });
  }

  const paged = paginate(filtered, PAGE_SIZE, page);
  const grouped = groupAndSort(paged);

  if (!append) container.innerHTML = '';
  if (!grouped.length) {
    container.innerHTML = '<div class="no-results">No matching events found.</div>';
    return;
  }

  grouped.forEach((exp, expIdx) => {
    const expCard = createCard('expansion-card', `
      <h2>${exp.expansion}</h2>
      <div class="expansion-content" id="exp-${expIdx}"></div>
    `);
    exp.sources.forEach((src, srcIdx) => {
      const srcTable = renderEventTable(src.items, srcIdx, expIdx);
      const srcCard = createCard('source-card', `
        <h3>${src.sourcename}</h3>
        <div>${srcTable}</div>
      `);
      expCard.querySelector('.expansion-content').appendChild(srcCard);
    });
    container.appendChild(expCard);
  });
}

export async function renderApp(containerId) {
  const appEl = document.getElementById(containerId);
  appEl.innerHTML = renderToolbar() + '<div id="events-list"></div>';
  const list = document.getElementById('events-list');

  allData = await loadAndEnrichData(evt => {
    document.body.style.cursor = 'wait';
  });
  document.body.style.cursor = 'default';

  updateExpansionOptions(allData);
  applyFiltersAndRender(list, allData, 1);

  const inputs = [
    'search-input', 'lootname-filter', 'loottype-filter',
    'chatcode-filter', 'minprice-filter', 'maxprice-filter',
    'vendormin-filter', 'vendormax-filter', 'sort-filter',
    'expansion-filter', 'rarity-filter', 'guaranteedonly-filter', 'chanceonly-filter'
  ];
  inputs.forEach(id =>
    document.getElementById(id)?.addEventListener('input', () =>
      applyFiltersAndRender(list, allData, 1)
    )
  );

  // Help Modal
  document.getElementById("side-help").addEventListener("click", () => {
    if (document.getElementById("modal-help")) return;
    const modal = document.createElement('div');
    modal.id = "modal-help";
    modal.style = `
      position:fixed;inset:0;background:#0006;
      display:flex;align-items:center;justify-content:center;
      z-index:9999;
    `;
    modal.innerHTML = `
      <div class="modal-content" style="background:white;padding:2em;border-radius:8px;max-width:520px;">
        <h2>How to Use</h2>
        <ul>
          <li>Use search and filters to find specific events</li>
          <li>Click event names or waypoints to open them on the wiki</li>
          <li>All loot and descriptions are now shown inline</li>
        </ul>
        <button class="copy-btn" onclick="this.closest('#modal-help').remove()">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  });

  // Infinite scroll
  window.addEventListener("scroll", () => {
    if (isLoading) return;
    const filters = getFiltersFromUI();
    const filtered = filterEvents(allData, filters);
    if (
      window.scrollY + window.innerHeight >= document.body.offsetHeight - 150 &&
      filtered.length > PAGE_SIZE * currentPage
    ) {
      isLoading = true;
      currentPage++;
      applyFiltersAndRender(list, allData, currentPage, true);
      isLoading = false;
    }
  });
}

// Init on page load
renderApp('app');
