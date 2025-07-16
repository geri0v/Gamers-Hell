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
          <option>Ascended</option>
          <option>Exotic</option>
          <option>Rare</option>
          <option>Masterwork</option>
          <option>Fine</option>
          <option>Basic</option>
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

function maxPriceFromLoot(loot = []) {
  return Math.max(...loot.map(l => l.price ?? 0));
}

function renderLootCards(loot, eventId) {
  const lootId = `loot-${eventId}`;
  const mostVal = getMostValuableDrop(loot);
  return `
    <button class="toggle-btn" data-target="${lootId}" aria-expanded="false">Show Loot</button>
    <div class="subcards hidden" id="${lootId}">
      ${loot.map(l => `
        <div class="subcard${l.guaranteed ? ' guaranteed' : ''}${l === mostVal ? ' most-valuable' : ''}">
          ${l.icon ? `<img src="${l.icon}" alt="" /> ` : ''}
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

function updateExpansionOptions(events) {
  const exps = [...new Set(events.map(e => e.expansion))].sort();
  const select = document.getElementById("expansion-filter");
  select.innerHTML = `<option value="">All Expansions</option>` + exps.map(e => `<option>${e}</option>`).join('');
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
          const eventId = `event-${expIdx}-${srcIdx}-${idx}`;
          e.value = maxPriceFromLoot(e.loot);
          const descId = `desc-${eventId}`;
          return `
            <tr id="${eventId}">
              <td>
                ${e.wikiLink ? `<a href="${e.wikiLink}" target="_blank">${e.name}</a>` : e.name}
              </td>
              <td>
                ${e.mapWikiLink ? `<a href="${e.mapWikiLink}" target="_blank">${e.map}</a>` : e.map}
              </td>
              <td>${e.waypointName || '–'}</td>
              <td>${e.code || '–'}</td>
            </tr>
            <tr>
              <td colspan="4">${createCopyBar(e)}</td>
            </tr>
            <tr>
              <td colspan="4">
                <button class="toggle-btn" data-target="${descId}" aria-expanded="false" style="margin-bottom:4px;">
                  Show Description
                </button>
                <div class="inline-desc hidden" id="${descId}">
                  ${e.description ? `<strong>Description:</strong> ${e.description}` : ''}
                </div>
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
    filtered = filtered.slice().sort((a, b) => {
      if (filters.sortKey === "value")
        return (b.value || 0) - (a.value || 0);
      if (filters.sortKey === "waypointName")
        return (a.waypointName || '').localeCompare(b.waypointName || '');
      if (filters.sortKey === "code")
        return (a.code || '').localeCompare(b.code || '');
      if (filters.sortKey === "map")
        return (a.map || '').localeCompare(b.map || '');
      return (a[filters.sortKey] || '').localeCompare(b[filters.sortKey] || '');
    });
  }

  const paged = paginate(filtered, PAGE_SIZE, page);
  const grouped = groupAndSort(paged);

  if (!append) container.innerHTML = '';
  if (!grouped.length) {
    container.innerHTML = `<div class="no-results">No results found.</div>`;
    return;
  }

  grouped.forEach((expansion, expIdx) => {
    const expCard = createCard('expansion-card', `
      <button class="toggle-btn" data-target="exp-${expIdx}">Toggle</button>
      <h2>${expansion.expansion}</h2>
      <div class="expansion-content" id="exp-${expIdx}"></div>
    `);

    expansion.sources.forEach((src, srcIdx) => {
      const srcContent = renderEventTable(src.items, srcIdx, expIdx);
      const srcCard = createCard('source-card', `
        <button class="toggle-btn" data-target="src-${expIdx}-${srcIdx}">Toggle</button>
        <h3>${src.sourcename}</h3>
        <div id="src-${expIdx}-${srcIdx}" class="source-content">${srcContent}</div>
      `);
      expCard.querySelector('.expansion-content').appendChild(srcCard);
    });

    container.appendChild(expCard);
  });

  setupToggles();
  container.querySelectorAll('th[data-sort-key]').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.sortKey;
      if (columnSort.key === key) {
        columnSort.dir = columnSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        columnSort = { key, dir: 'asc' };
      }
      applyFiltersAndRender(container, allData, 1);
    };
  });
}

export async function renderApp(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = renderToolbar() + `<div id="events-list"></div>`;
  const list = document.getElementById("events-list");

  allData = await loadAndEnrichData(evt => {
    document.body.style.cursor = 'wait';
  });

  updateExpansionOptions(allData);
  applyFiltersAndRender(list, allData);

  // Attach filter inputs
  [
    "search-input", "lootname-filter", "loottype-filter", "chatcode-filter",
    "minprice-filter", "maxprice-filter", "vendormin-filter", "vendormax-filter",
    "sort-filter", "expansion-filter", "rarity-filter", "guaranteedonly-filter", "chanceonly-filter"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => applyFiltersAndRender(list, allData, 1));
  });

  // Help modal (ARIA, focus, Esc support)
  document.getElementById("side-help").addEventListener("click", () => {
    if (document.getElementById("modal-help")) return;
    const overlay = document.createElement('div');
    overlay.id = "modal-help";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style = `
      position:fixed;inset:0;background:#0006;z-index:9999;
      display:flex;align-items:center;justify-content:center;
    `;
    overlay.innerHTML = `
      <div class="modal-content" tabindex="0" style="
        outline: none; background:white; padding:2em; border-radius:10px; max-width:500px;">
        <h2 id="help-title">How to Use</h2>
        <ul>
          <li>Use search/filter rows to find events and loot.</li>
          <li>Click event/map names for Wiki links.</li>
          <li>Toggle loot/description to view or hide detail.</li>
          <li>Copy event summaries with the copy button.</li>
        </ul>
        <button class="copy-btn" id="close-help" style="margin-top:1em;">Close</button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Close modal by overlay or by Close button/Esc
    const cleanup = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };
    overlay.querySelector("#close-help").onclick = cleanup;
    overlay.querySelector(".modal-content").focus();
    document.addEventListener('keydown', function handler(e) {
      if (e.key === "Escape") {
        cleanup();
        document.removeEventListener('keydown', handler);
      }
    });
  });

  // Infinite Scroll, dedupe events
  window.addEventListener("scroll", () => {
    if (isLoading) return;
    const filters = getFiltersFromUI();
    const filtered = filterEvents(allData, filters);
    const prevPageCount = PAGE_SIZE * currentPage;
    const nextPaged = paginate(filtered, PAGE_SIZE, currentPage + 1);
    if (
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200
      && nextPaged.length > prevPageCount
    ) {
      isLoading = true;
      currentPage++;
      applyFiltersAndRender(list, allData, currentPage, true);
      isLoading = false;
    }
  });
}

// Init app
renderApp('app');
