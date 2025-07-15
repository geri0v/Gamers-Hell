import { fetchAllData, groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichData, formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/loader.js';
import { createCopyBar, getMostValuableDrop } from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';
import { setupToggles } from 'https://geri0v.github.io/Gamers-Hell/js/toggle.js';
import { filterEvents } from 'https://geri0v.github.io/Gamers-Hell/js/search.js';
import { paginate } from 'https://geri0v.github.io/Gamers-Hell/js/pagination.js';
import { getCurrentLang, langMenuHTML, setCurrentLang } from 'https://geri0v.github.io/Gamers-Hell/js/lang.js';

let allData = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let isLoading = false;
let columnSort = {};
let ghdvLang = getCurrentLang();

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

function renderSearchAndSort() {
  return `
    <div id="main-controls-wrap">
      <div class="search-sort-card">
        <div class="search-bar-row">
          <input id="search-input" type="text" aria-label="Search events or map" placeholder="Search event or map...">
        </div>
        <div class="filter-row">
          <select id="expansion-filter" aria-label="Filter by Expansion">
            <option value="">All Expansions</option>
          </select>
          <select id="rarity-filter" aria-label="Filter by Rarity">
            <option value="">All Rarities</option>
            <option value="Ascended">Ascended</option>
            <option value="Exotic">Exotic</option>
            <option value="Rare">Rare</option>
            <option value="Masterwork">Masterwork</option>
            <option value="Fine">Fine</option>
            <option value="Basic">Basic</option>
          </select>
        </div>
        <div class="sort-row">
          <select id="sort-filter" aria-label="Sort by">
            <option value="">Sort By</option>
            <option value="name">Name</option>
            <option value="expansion">Expansion</option>
            <option value="map">Map</option>
            <option value="value">Value</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function updateExpansionOptions(events) {
  const exps = [...new Set(events.map(e => e.expansion))].sort();
  const select = document.getElementById('expansion-filter');
  select.innerHTML = `<option value="">All Expansions</option>` +
    exps.map(exp => `<option value="${exp}">${exp}</option>`).join('');
}

function alwaysSortIcons(col, activeCol, dir) {
  let icon = "▲▼";
  if (col === activeCol) icon = dir === "asc" ? "▲" : "▼";
  return `<span class="sort-icons">${icon}</span>`;
}

function renderEventTables(eventData) {
  const container = document.getElementById('events-list');
  container.innerHTML = '';

  const grouped = groupAndSort(eventData);

  if (grouped.length === 0) {
    container.innerHTML = `<div class="no-results">No matching events. Try adjusting search, sort, or filters.</div>`;
    return;
  }

  grouped.forEach((exp, expIdx) => {
    const expId = `exp-${expIdx}`;
    const expDiv = createCard('expansion-card', `
      <button class="toggle-btn" data-target="${expId}" aria-expanded="false">Show</button>
      <h2>${exp.expansion}</h2>
      <div class="expansion-content" id="${expId}"></div>
    `);

    exp.sources.forEach((src, srcIdx) => {
      const srcId = `source-${expIdx}-${srcIdx}`;
      const srcDiv = createCard('source-card', `
        <button class="toggle-btn" data-target="${srcId}" aria-expanded="false">Show</button>
        <h3>${src.sourcename}</h3>
        <div class="source-content" id="${srcId}">
          ${renderEventTable(src.items)}
        </div>
      `);

      expDiv.querySelector('.expansion-content').appendChild(srcDiv);
    });

    container.appendChild(expDiv);
  });
}

function renderEventTable(events) {
  return `
    <table class="event-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Map</th>
          <th>Code</th>
        </tr>
      </thead>
      <tbody>
        ${events.map(ev => renderEventRow(ev)).join('')}
      </tbody>
    </table>
  `;
}

function renderEventRow(ev) {
  const code = ev.code || '';
  const codeStr = ev.waypointName && ev.waypointWikiLink
    ? `<a href="${ev.waypointWikiLink}" target="_blank">${ev.waypointName}</a> ${code}`
    : code;

  const lootCards = ev.loot ? renderLoot(ev.loot) : '';
  const copyBar = createCopyBar(ev);

  return `
    <tr>
      <td>${ev.wikiLink ? `<a href="${ev.wikiLink}" target="_blank">${ev.name}</a>` : ev.name}</td>
      <td>${ev.mapWikiLink ? `<a href="${ev.mapWikiLink}" target="_blank">${ev.map}</a>` : ev.map}</td>
      <td>${codeStr}</td>
    </tr>
    <tr>
      <td colspan="3">${copyBar}</td>
    </tr>
    <tr>
      <td colspan="3">${lootCards}</td>
    </tr>
  `;
}

function renderLoot(loot) {
  return `
    <div class="subcards">
      ${loot.map(l => `
        <div class="subcard${l.guaranteed ? ' guaranteed' : ''}">
          ${l.icon ? `<img src="${l.icon}" alt="" style="height:1.2em;vertical-align:middle;margin-right:0.3em;">` : ''}
          ${l.wikiLink ? `<a href="${l.wikiLink}" target="_blank">${l.name}</a>` : l.name}
          ${l.price !== undefined && l.price !== null ? `<div>Price: ${formatPrice(l.price)}</div>` : ''}
          ${l.vendorValue !== undefined && l.vendorValue !== null ? `<div>Vendor: ${formatPrice(l.vendorValue)}</div>` : ''}
          ${l.accountBound !== undefined ? `<div>Accountbound: ${l.accountBound ? 'Yes' : 'No'}</div>` : ''}
          ${l.guaranteed ? `<div class="guaranteed-badge">Guaranteed</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function applyFiltersAndRender(sourceData) {
  const searchTerm = document.getElementById('search-input').value;
  const expansion = document.getElementById('expansion-filter').value;
  const rarity = document.getElementById('rarity-filter').value;
  const sortKey = document.getElementById('sort-filter').value;
  let events = filterEvents(sourceData, { searchTerm, expansion, rarity, sortKey });

  if (columnSort.key && columnSort.dir) {
    const { key, dir } = columnSort;
    events = events.slice().sort((a, b) => {
      const aVal = (a[key] || '').toLowerCase();
      const bVal = (b[key] || '').toLowerCase();
      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const paged = paginate(events, PAGE_SIZE, currentPage);
  renderEventTables(paged);
}

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('app');
  container.innerHTML = '<div class="loader">Loading data...</div>';

  try {
    const flat = await fetchAllData();
    const enriched = await enrichData(flat, null, ghdvLang);
    allData = enriched;

    container.innerHTML = `
      <div class="sticky-bar">${renderSearchAndSort()}</div>
      <div id="events-list" class="centered-wrap"></div>
    `;

    updateExpansionOptions(allData);
    applyFiltersAndRender(allData);

    document.getElementById('search-input').addEventListener('input', () => {
      currentPage = 1;
      applyFiltersAndRender(allData);
    });

    document.getElementById('expansion-filter').addEventListener('change', () => {
      currentPage = 1;
      applyFiltersAndRender(allData);
    });

    document.getElementById('rarity-filter').addEventListener('change', () => {
      currentPage = 1;
      applyFiltersAndRender(allData);
    });

    document.getElementById('sort-filter').addEventListener('change', () => {
      currentPage = 1;
      columnSort = {};
      applyFiltersAndRender(allData);
    });

    setupToggles();
  } catch (err) {
    container.innerHTML = `<div class="no-results">Error loading data: ${err.message}</div>`;
    console.error('Load error:', err);
  }
});
