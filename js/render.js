// render.js — for new info.js + infoload.js enrichment architecture

import { loadAndEnrichData } from 'https://geri0v.github.io/Gamers-Hell/js/infoload.js';
import { groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/info.js';
import { createCopyBar, createMostValuableBadge, getMostValuableDrop } from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';
import { setupToggles } from 'https://geri0v.github.io/Gamers-Hell/js/toggle.js';
import { filterEvents } from 'https://geri0v.github.io/Gamers-Hell/js/search.js';
import { paginate } from 'https://geri0v.github.io/Gamers-Hell/js/pagination.js';

let allData = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let isLoading = false;
let columnSort = {};
let compactLootLayout = false;

function renderSearchAndSort() {
  return `
    <div id="main-controls-wrap">
      <div id="side-buttons">
        <button class="side-btn" id="side-help" aria-label="Help" tabindex="0">?</button>
        <button class="side-btn" id="toggle-compact" aria-label="Toggle loot layout" title="Toggle compact loot cards">🗂️</button>
      </div>
      <div class="search-sort-card">
        <div class="search-bar-row">
          <input id="search-input" aria-label="Search" type="text" placeholder="Search event or map..." />
        </div>
        <div class="filter-row">
          <select id="expansion-filter" aria-label="Expansion Filter"><option value="">All Expansions</option></select>
          <select id="rarity-filter" aria-label="Rarity Filter">
            <option value="">All Rarities</option>
            <option>Ascended</option><option>Exotic</option><option>Rare</option>
            <option>Masterwork</option><option>Fine</option><option>Basic</option>
          </select>
          <input id="lootname-filter" placeholder="Loot name..." type="text" style="width: 10em;" />
          <input id="loottype-filter" placeholder="Type..." type="text" style="width: 7em;" />
          <input id="vendormin-filter" placeholder="Min vendor" type="number" style="width: 6em;" />
          <input id="vendormax-filter" placeholder="Max vendor" type="number" style="width: 6em;" />
          <input id="chatcode-filter" placeholder="Chatcode..." type="text" style="width: 6em;" />
          <label><input type="checkbox" id="guaranteedonly-filter" /> Guaranteed</label>
          <label><input type="checkbox" id="chanceonly-filter" /> Chance</label>
        </div>
        <div class="sort-row">
          <select id="sort-filter" aria-label="Sort By">
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

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

function renderProgressBar(percent) {
  return `<div class="progress-bar-container"><div class="progress-bar" style="width:${percent}%;"></div></div>`;
}

function updateExpansionOptions(events) {
  const exps = [...new Set(events.map(e => e.expansion))].sort();
  const select = document.getElementById('expansion-filter');
  select.innerHTML = `<option value="">All Expansions</option>` + exps.map(e => `<option>${e}</option>`).join('');
}

function alwaysSortIcons(col, activeCol, dir) {
  if (col !== activeCol) return "▲▼";
  return dir === "asc" ? "▲" : "▼";
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
          ${l.icon ? `<img src="${l.icon}" alt="" style="height:1.2em;margin-right:0.3em;">` : ''}
          ${l.wikiLink ? `<a href="${l.wikiLink}" target="_blank">${l.name}</a>` : l.name}
          ${l.price != null ? `<div><strong>Price:</strong> ${formatPrice(l.price)}</div>` : ''}
          ${l.vendorValue != null ? `<div><strong>Vendor:</strong> ${formatPrice(l.vendorValue)}</div>` : ''}
          ${l.chatCode ? `<div><strong>Chatcode:</strong> ${l.chatCode}</div>` : ''}
          ${l.accountBound !== undefined ? `<div><strong>Accountbound:</strong> ${l.accountBound ? 'Yes' : 'No'}</div>` : ''}
          ${l.guaranteed ? `<div class="guaranteed-badge">Guaranteed</div>` : ''}
          ${l === mostVal ? createMostValuableBadge(l) : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderEventTable(events, sourceIdx, expIdx) {
  return `
    <table class="event-table">
      <thead>
        <tr>
          <th data-sort-key="name">Name ${alwaysSortIcons("name", columnSort.key, columnSort.dir)}</th>
          <th data-sort-key="map">Map ${alwaysSortIcons("map", columnSort.key, columnSort.dir)}</th>
          <th data-sort-key="code">Code ${alwaysSortIcons("code", columnSort.key, columnSort.dir)}</th>
        </tr>
      </thead>
      <tbody>
        ${events.map((item, itemIdx) => {
          const eventId = `event-${expIdx}-${sourceIdx}-${itemIdx}`;
          const anchor = "event-" + (item.name || "").replace(/\W/g, "");
          const code = item.waypointName && item.waypointWikiLink
            ? `<a href="${item.waypointWikiLink}" target="_blank">${item.waypointName}</a> ${item.code}`
            : item.code;
          return `
            <tr id="${anchor}">
              <td>${item.wikiLink ? `<a href="${item.wikiLink}" target="_blank">${item.name}</a>` : item.name} <a href="#${anchor}">🔗</a></td>
              <td>${item.mapWikiLink ? `<a href="${item.mapWikiLink}" target="_blank">${item.map}</a>` : item.map}</td>
              <td>${code}</td>
            </tr>
            <tr><td colspan="3">${createCopyBar(item)}</td></tr>
            <tr><td colspan="3">${renderLootCards(item.loot, eventId)}</td></tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
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

function applyFiltersAndRender(container, events, page = 1, append = false) {
  const filters = getFiltersFromUI();

  let filtered = filterEvents(events, filters);
  if (columnSort.key && columnSort.dir) {
    filtered = filtered.slice().sort((a, b) => {
      const aVal = (a[columnSort.key] || '').toLowerCase();
      const bVal = (b[columnSort.key] || '').toLowerCase();
      return columnSort.dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }

  const paged = paginate(filtered, PAGE_SIZE, page);
  const grouped = groupAndSort(paged);

  if (!append) container.innerHTML = '';
  if (!filtered.length) {
    container.innerHTML = `<div class="no-results">No results found.</div>`;
    return;
  }

  grouped.forEach((exp, expIdx) => {
    const expCard = createCard('expansion-card', `
      <button class="toggle-btn" data-target="expansion-${expIdx}">Show/Hide</button>
      <h2>${exp.expansion}</h2>
      <div id="expansion-${expIdx}" class="expansion-content"></div>
    `);
    exp.sources.forEach((src, srcIdx) => {
      const srcCard = createCard('source-card', `
        <button class="toggle-btn" data-target="src-${expIdx}-${srcIdx}">Show/Hide</button>
        <h3>${src.sourcename}</h3>
        <div id="src-${expIdx}-${srcIdx}" class="source-content">
          ${renderEventTable(src.items, srcIdx, expIdx)}
        </div>
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
      currentPage = 1;
      applyFiltersAndRender(container, allData, currentPage, false);
    };
  });
}

export async function renderApp(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = renderProgressBar(10) + '<div>Loading events...</div>';

  allData = await loadAndEnrichData(evt => {
    container.querySelector('.progress-bar').style.width = '80%';
  });

  container.innerHTML = `<div class="sticky-bar">${renderSearchAndSort()}</div><div id="events-list" class="centered-wrap"></div>`;
  updateExpansionOptions(allData);
  const evtList = document.getElementById('events-list');
  applyFiltersAndRender(evtList, allData);

  [
    'search-input', 'expansion-filter', 'rarity-filter',
    'lootname-filter', 'loottype-filter', 'vendormin-filter',
    'vendormax-filter', 'chatcode-filter',
    'guaranteedonly-filter', 'chanceonly-filter', 'sort-filter'
  ].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      currentPage = 1;
      applyFiltersAndRender(evtList, allData, currentPage);
    });
  });

  document.getElementById('toggle-compact').addEventListener('click', () => {
    compactLootLayout = !compactLootLayout;
    applyFiltersAndRender(evtList, allData, currentPage);
  });

  document.getElementById('side-help').addEventListener('click', () => {
    if (document.getElementById('modal-help')) return;
    const modal = createCard('modal-help', `
      <div class="modal-content">
        <h2>GW2 Event Visualizer Help</h2>
        <ul>
          <li>Search, filter, and group events using the controls above</li>
          <li>Click event names to visit the wiki</li>
          <li>Click 🗂️ for compact or expanded loot view</li>
          <li>Click 🔗 next to each name for direct link</li>
        </ul>
      </div>
    `);
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
  });

  window.addEventListener('scroll', () => {
    if (isLoading) return;
    const bottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 100;
    if (bottom && paginate(filterEvents(allData, getFiltersFromUI()), PAGE_SIZE, currentPage + 1).length) {
      isLoading = true;
      currentPage++;
      applyFiltersAndRender(evtList, allData, currentPage, true);
      isLoading = false;
    }
  });
}

// To auto-run on page load (can also use as module)
renderApp('app');
