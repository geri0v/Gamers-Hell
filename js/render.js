import { loadAndEnrichData } from 'https://geri0v.github.io/Gamers-Hell/js/infoload.js';
import { groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/info.js';
import { createCopyBar, createMostValuableBadge, getMostValuableDrop } from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';
import { setupToggles } from 'https://geri0v.github.io/Gamers-Hell/js/toggle.js';
import { filterEvents } from 'https://geri0v.github.io/Gamers-Hell/js/search.js';
import { paginate } from 'https://geri0v.github.io/Gamers-Hell/js/pagination.js';

let allData = [];
let currentPage = 1;
let isLoading = false;
let columnSort = {};
let compactLootLayout = false;
const PAGE_SIZE = 20;
const renderedSet = new Set(); // Prevent infinite repeat scroll

function renderSearchUI() {
  return `
    <div id="main-controls-wrap">
      <div class="toolbar-top">
        <button class="side-btn" id="side-help" aria-label="Help">❓</button>
        <button class="side-btn" id="toggle-compact" aria-label="Toggle loot layout">🗂️</button>
        <input id="search-input" aria-label="Search" placeholder="Search event or map..." />
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
          <option value="value">Value</option>
        </select>
      </div>
    </div>
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

function maxPriceFromLoot(loot = []) {
  return Math.max(...loot.map(l => l.price ?? 0));
}

function renderEventTable(events, sourceIdx, expIdx) {
  return `
    <table class="event-table">
      <thead>
        <tr>
          <th data-sort-key="name">Name</th>
          <th data-sort-key="map">Map</th>
          <th data-sort-key="code">Code</th>
        </tr>
      </thead>
      <tbody>
        ${events.map((event, eventIdx) => {
          const id = `event-${expIdx}-${sourceIdx}-${eventIdx}`;
          const anchor = id;
          event.value = maxPriceFromLoot(event.loot);

          return `
            <tr id="${anchor}">
              <td><a href="#${anchor}" aria-label="Link to ${event.name}">${event.name}</a></td>
              <td>${event.map}</td>
              <td>${event.waypointWikiLink ? `<a href="${event.waypointWikiLink}" target="_blank">${event.waypointName}</a>` : ''} ${event.code}</td>
            </tr>
            <tr><td colspan="3">${createCopyBar(event)}</td></tr>
            <tr><td colspan="3">${renderLootCards(event.loot || [], id)}</td></tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderLootCards(loot, eventId) {
  if (!loot.length) return '';
  const lootId = `loot-${eventId}`;
  const mostVal = getMostValuableDrop(loot);
  return `
    <button class="toggle-btn" data-target="${lootId}" aria-expanded="false">Show</button>
    <div class="subcards${compactLootLayout ? ' compact' : ''} hidden" id="${lootId}">
      ${loot.map(item => `
        <div class="subcard${item.guaranteed ? ' guaranteed' : ''}${item === mostVal ? ' most-valuable' : ''}">
          ${item.icon ? `<img src="${item.icon}" alt="" style="height:1.2em;"> ` : ''}
          ${item.wikiLink ? `<a href="${item.wikiLink}" target="_blank">${item.name}</a>` : item.name || 'Unknown'}
          ${item.price != null ? `<div><strong>Price:</strong> ${formatPrice(item.price)}</div>` : ''}
          ${item.vendorValue != null ? `<div><strong>Vendor:</strong> ${formatPrice(item.vendorValue)}</div>` : ''}
          ${item.chatCode ? `<div><strong>Chatcode:</strong> ${item.chatCode}</div>` : ''}
          ${item.accountBound ? `<div><strong>Bound:</strong> Yes</div>` : ''}
          ${item.guaranteed ? '<div class="guaranteed-badge">Guaranteed</div>' : ''}
          ${item === mostVal ? createMostValuableBadge(item) : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function applyFiltersAndRender(container, data, page = 1, append = false) {
  const filters = getFiltersFromUI();
  const filtered = filterEvents(data, filters);
  if (!filtered.length && !append) {
    container.innerHTML = `<div class="no-results">No results found</div>`;
    return;
  }

  const sorted = filters.sortKey === 'value'
    ? [...filtered].sort((a, b) => (b.value || 0) - (a.value || 0))
    : filtered;

  const paged = paginate(sorted, PAGE_SIZE, page);
  const grouped = groupAndSort(paged);

  if (!append) container.innerHTML = '';
  grouped.forEach((expansion, expIdx) => {
    const expDiv = createCard('expansion-card', `
      <button class="toggle-btn" data-target="exp-${expIdx}">Toggle</button>
      <h2>${expansion.expansion}</h2>
      <div class="expansion-content" id="exp-${expIdx}"></div>
    `);
    expansion.sources.forEach((src, srcIdx) => {
      const srcHtml = renderEventTable(src.items, srcIdx, expIdx);
      expDiv.querySelector('.expansion-content').appendChild(
        createCard('source-card', `
          <button class="toggle-btn" data-target="src-${expIdx}-${srcIdx}">Toggle</button>
          <h3>${src.sourcename}</h3>
          <div id="src-${expIdx}-${srcIdx}" class="source-content">${srcHtml}</div>
        `)
      );
    });
    container.appendChild(expDiv);
  });

  setupToggles();
}

export async function renderApp(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = `<div class="progress-bar-container"><div class="progress-bar" style="width:5%;"></div></div><div>Loading...</div>`;

  allData = await loadAndEnrichData(evt => {
    const bar = document.querySelector('.progress-bar');
    if (bar) bar.style.width = '80%';
  });

  el.innerHTML = renderSearchUI() + `<div id="events-list"></div>`;
  const list = document.getElementById('events-list');
  applyFiltersAndRender(list, allData, 1);

  // Register interactions
  document.getElementById('toggle-compact').onclick = () => {
    compactLootLayout = !compactLootLayout;
    applyFiltersAndRender(list, allData, 1);
  };

  document.getElementById('side-help').onclick = () => {
    if (document.getElementById('modal-help')) return;
    const modal = document.createElement('div');
    modal.id = 'modal-help';
    modal.role = 'dialog';
    modal.ariaModal = 'true';
    modal.tabIndex = -1;
    modal.style = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0005;display:flex;align-items:center;justify-content:center;z-index:1000;';
    modal.innerHTML = `
      <div style="background:white;padding:2em;border-radius:8px;max-width:500px;">
        <h2 id="help-title">How to Use</h2>
        <ul>
          <li>Use 🔍 and filters to narrow results</li>
          <li>Click 🗂️ to switch loot layout</li>
          <li>Click event/map names or icons for wiki</li>
          <li>Use copy button to grab full loot summary</li>
        </ul>
      </div>`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
    setTimeout(() => modal.focus(), 200);
  };

  [
    'search-input', 'expansion-filter', 'rarity-filter',
    'lootname-filter', 'loottype-filter', 'vendormin-filter',
    'vendormax-filter', 'chatcode-filter', 'guaranteedonly-filter',
    'chanceonly-filter', 'sort-filter'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => applyFiltersAndRender(list, allData, 1));
  });

  // Infinite scroll (stop when no more)
  window.addEventListener('scroll', () => {
    const bottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
    if (bottom && !isLoading) {
      const currentCount = paginate(filterEvents(allData, getFiltersFromUI()), PAGE_SIZE, currentPage + 1).length;
      if (currentCount === 0) return;
      isLoading = true;
      currentPage++;
      applyFiltersAndRender(list, allData, currentPage, true);
      isLoading = false;
    }
  });
}

// Auto-run the app (for non-SSR mode)
renderApp('app');
