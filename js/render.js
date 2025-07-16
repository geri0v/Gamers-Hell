// render.js — Fully Featured, All Toggles, Filters, Descriptions, Scroll + Sort

// (Import statements same as before, unchanged)
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

function renderSearchAndFilters() {
  return `
    <div id="main-controls-wrap">
      <div class="toolbar-top">
        <button class="side-btn" id="side-help" aria-label="Help">❓</button>
        <button class="side-btn" id="toggle-compact" aria-label="Toggle loot layout">🗂️</button>
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
    rarity: document.getElementById('rarity-filter').value,
    expansion: document.getElementById('expansion-filter').value,
    lootName: document.getElementById('lootname-filter').value,
    itemType: document.getElementById('loottype-filter').value,
    chatcode: document.getElementById('chatcode-filter').value,
    vendorValueMin: Number(document.getElementById('vendormin-filter').value) || undefined,
    vendorValueMax: Number(document.getElementById('vendormax-filter').value) || undefined,
    minprice: Number(document.getElementById('minprice-filter').value) || undefined,
    maxprice: Number(document.getElementById('maxprice-filter').value) || undefined,
    guaranteedOnly: document.getElementById('guaranteedonly-filter').checked,
    chanceOnly: document.getElementById('chanceonly-filter').checked,
    sortKey: document.getElementById('sort-filter').value
  };
}

function maxPriceFromLoot(loot = []) {
  return Math.max(...loot.map(l => l.price ?? 0));
}

function renderLootCards(loot, eventId) {
  const lootId = `loot-${eventId}`;
  const mostVal = getMostValuableDrop(loot);
  return `
    <button class="toggle-btn" data-target="${lootId}" aria-expanded="false">Show</button>
    <div class="subcards${compactLootLayout ? " compact" : ""} hidden" id="${lootId}">
      ${loot.map(l => `
        <div class="subcard${l.guaranteed ? " guaranteed" : ""}${l === mostVal ? " most-valuable" : ""}">
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
          const eventId = `event-${expIdx}-${srcIdx}-${idx}`;
          e.value = maxPriceFromLoot(e.loot);
          const descId = `desc-${eventId}`;
          return `
            <tr id="${eventId}">
              <td>${e.name}</td>
              <td>${e.mapWikiLink ? `<a href="${e.mapWikiLink}" target="_blank">${e.map}</a>` : e.map}</td>
              <td>${e.waypointName || '–'}</td>
              <td>${e.code || '–'}</td>
            </tr>
            <tr>
              <td colspan="4">${createCopyBar(e)}</td>
            </tr>
            <tr>
              <td colspan="4">
                <button class="toggle-btn" data-target="${descId}" aria-expanded="false">Show Description</button>
                <div class="inline-desc hidden" id="${descId}">
                  ${e.description || ''}
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

function updateExpansionOptions(events) {
  const exps = [...new Set(events.map(e => e.expansion))].sort();
  const select = document.getElementById("expansion-filter");
  select.innerHTML = `<option value="">All Expansions</option>` + exps.map(e => `<option>${e}</option>`).join('');
}

function applyFiltersAndRender(container, data, page = 1, append = false) {
  const filtered = filterEvents(data, getFiltersFromUI());
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
  container.innerHTML = renderSearchAndFilters() + `<div id="events-list"></div>`;
  const list = document.getElementById("events-list");

  allData = await loadAndEnrichData(evt => {
    document.body.style.cursor = 'wait';
  });

  updateExpansionOptions(allData);
  applyFiltersAndRender(list, allData);

  // Inputs
  ["search-input", "lootname-filter", "loottype-filter", "chatcode-filter", "minprice-filter", "maxprice-filter",
   "vendormin-filter", "vendormax-filter", "sort-filter", "expansion-filter", "rarity-filter",
   "guaranteedonly-filter", "chanceonly-filter"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => applyFiltersAndRender(list, allData, 1));
  });

  document.getElementById("toggle-compact").addEventListener("click", () => {
    compactLootLayout = !compactLootLayout;
    applyFiltersAndRender(list, allData, 1);
  });

  document.getElementById("side-help").addEventListener("click", () => {
    if (document.getElementById("modal-help")) return;
    const modal = createCard('modal-help', `
      <div class="modal-content">
        <h2>Help &amp; About</h2>
        <p>Filter and search loot and events in dropdowns above.</p>
        <ul>
          <li>🔍 Search by name, type, waypoint</li>
          <li>🗂️ Toggle loot size for compact view</li>
          <li>🧾 Copy event summaries easily</li>
        </ul>
      </div>
    `);
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
  });

  // Infinite Scroll — with dedup check:
  window.addEventListener("scroll", () => {
    const filters = getFiltersFromUI();
    const filtered = filterEvents(allData, filters);
    const visibleCount = paginate(filtered, PAGE_SIZE, currentPage).map(e => e.name);
    const nextSet = paginate(filtered, PAGE_SIZE, currentPage + 1)
      .filter(e => !renderedSet.has(e.name));

    if (!isLoading && nextSet.length) {
      const scrollBottom = window.scrollY + window.innerHeight >= document.body.offsetHeight - 200;
      if (scrollBottom) {
        isLoading = true;
        nextSet.forEach(e => renderedSet.add(e.name));
        currentPage++;
        applyFiltersAndRender(document.getElementById("events-list"), allData, currentPage, true);
        isLoading = false;
      }
    }
  });
}
