import { fetchAllData, groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichData, formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/loader.js';
import { createCopyBar } from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';
import { setupToggles } from 'https://geri0v.github.io/Gamers-Hell/js/toggle.js';
import { filterEvents } from 'https://geri0v.github.io/Gamers-Hell/js/search.js';
import { paginate } from 'https://geri0v.github.io/Gamers-Hell/js/pagination.js';

let allData = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let isLoading = false;
let columnSort = {};

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

function renderSearchAndSort() {
  return `
    <div id="main-controls-wrap">
      <div id="side-buttons">
        <button class="side-btn" id="side-help" aria-label="Show controls help" tabindex="0">?</button>
        <!-- Future: <button class="side-btn" id="side-lang" aria-label="Translate" tabindex="0">🌐</button> -->
      </div>
      <div class="search-sort-card">
        <div class="search-bar-row">
          <input id="search-input" aria-label="Search events or map" type="text" placeholder="Search event or map..." />
        </div>
        <div class="filter-row">
          <select id="expansion-filter" aria-label="Filter by Expansion"><option value="">All Expansions</option></select>
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

function renderLootCards(loot, eventId) {
  if (!Array.isArray(loot) || loot.length === 0) return '';
  const lootId = `loot-${eventId}`;
  return `
    <button class="toggle-btn" data-target="${lootId}" aria-expanded="false">Show</button>
    <div class="subcards hidden" id="${lootId}">
      ${loot.map(l => `
        <div class="subcard${l.guaranteed ? ' guaranteed' : ''}">
          ${l.icon ? `<img src="${l.icon}" alt="" style="height:1.2em;vertical-align:middle;margin-right:0.3em;">` : ''}
          ${l.wikiLink ? `<a href="${l.wikiLink}" target="_blank">${l.name}</a>` : l.name}
          ${l.price !== undefined && l.price !== null ? `<div><strong>Price:</strong> ${formatPrice(l.price)}</div>` : ''}
          ${l.vendorValue !== undefined && l.vendorValue !== null ? `<div><strong>Vendor:</strong> ${formatPrice(l.vendorValue)}</div>` : ''}
          ${l.chatCode ? `<div><strong>Chatcode:</strong> ${l.chatCode}</div>` : ''}
          ${l.accountBound !== undefined ? `<div><strong>Accountbound:</strong> ${l.accountBound ? 'Yes' : 'No'}</div>` : ''}
          ${l.guaranteed ? `<div class="guaranteed-badge">Guaranteed</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderEventTable(events, sourceIdx, expIdx) {
  // Sorting arrow logic
  function sortClass(col) {
    if (columnSort.key === col) return columnSort.dir === 'asc' ? 'sorted-asc' : 'sorted-desc';
    return '';
  }

  return `
    <table class="event-table" role="table" aria-label="Event Table">
      <thead>
        <tr role="row">
          <th role="columnheader" scope="col" aria-sort="${columnSort.key === 'name' ? columnSort.dir : 'none'}" tabindex="0" data-sort-key="name" class="${sortClass('name')}">Name</th>
          <th role="columnheader" scope="col" aria-sort="${columnSort.key === 'map' ? columnSort.dir : 'none'}" tabindex="0" data-sort-key="map" class="${sortClass('map')}">Map</th>
          <th role="columnheader" scope="col" aria-sort="${columnSort.key === 'code' ? columnSort.dir : 'none'}" tabindex="0" data-sort-key="code" class="${sortClass('code')}">Code</th>
        </tr>
      </thead>
      <tbody>
        ${events.map((item, itemIdx) => {
          const eventId = `event-${expIdx}-${sourceIdx}-${itemIdx}`;
          return `
            <tr role="row" id="event-${item.name.replace(/\W/g, '')}">
              <td role="cell">
                ${item.wikiLink ? `<a href="${item.wikiLink}" target="_blank">${item.name}</a>` : item.name}
                <a href="#event-${item.name.replace(/\W/g, '')}" aria-label="Direct link to ${item.name}" style="color: #666; text-decoration:none; margin-left:0.3em; font-size:0.96em;">🔗</a>
              </td>
              <td role="cell">
                ${item.mapWikiLink ? `<a href="${item.mapWikiLink}" target="_blank">${item.map}</a>` : item.map}
              </td>
              <td role="cell">
                ${item.waypointName && item.waypointWikiLink
                  ? `<a href="${item.waypointWikiLink}" target="_blank">${item.waypointName}</a> `
                  : ''}
                ${item.code || ''}
              </td>
            </tr>
            <tr>
              <td colspan="3">
                ${createCopyBar(item)}
              </td>
            </tr>
            <tr>
              <td colspan="3">
                ${renderLootCards(item.loot, eventId)}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderProgressBar(percent) {
  return `
    <div class="progress-bar-container" aria-label="Loading Progress">
      <div class="progress-bar" style="width:${percent}%;"></div>
    </div>
  `;
}

function renderNoResults() {
  return `<div class="no-results" aria-live="polite">No results found. Try changing your filter, search, or expansion.</div>`;
}

// Main filter/apply logic must ensure sticky header, centered controls
function applyFiltersAndRender(container, allEvents, pageNumber = 1, append = false) {
  const searchTerm = document.getElementById('search-input').value;
  const expansion = document.getElementById('expansion-filter').value;
  const rarity = document.getElementById('rarity-filter').value;
  const sortKey = document.getElementById('sort-filter').value;
  let filteredEvents = filterEvents(allEvents, { searchTerm, expansion, rarity, sortKey });
  if (columnSort.key && columnSort.dir) {
    filteredEvents = filteredEvents.slice().sort((a, b) => {
      const key = columnSort.key;
      const aVal = (a[key] || '').toLowerCase();
      const bVal = (b[key] || '').toLowerCase();
      if (aVal < bVal) return columnSort.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return columnSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const pagedEvents = paginate(filteredEvents, PAGE_SIZE, pageNumber);
  const grouped = groupAndSort(pagedEvents);

  if (!append) container.innerHTML = '';
  if (filteredEvents.length === 0) {
    container.innerHTML = renderNoResults();
    return;
  }

  grouped.forEach((exp, expIdx) => {
    const expId = `expansion-${expIdx}`;
    const expDiv = createCard('expansion-card', `
      <button class="toggle-btn" data-target="${expId}" aria-expanded="false">Show/Hide</button>
      <h2>${exp.expansion}</h2>
      <div class="expansion-content" id="${expId}"></div>
    `);
    exp.sources.forEach((src, srcIdx) => {
      const srcId = `source-${expIdx}-${srcIdx}`;
      const srcDiv = createCard('source-card', `
        <button class="toggle-btn" data-target="${srcId}" aria-expanded="false">Show/Hide</button>
        <h3>${src.sourcename}</h3>
        <div class="source-content" id="${srcId}">
          ${renderEventTable(src.items, srcIdx, expIdx)}
        </div>
      `);
      expDiv.querySelector('.expansion-content').appendChild(srcDiv);
    });
    container.appendChild(expDiv);
  });
  setupToggles();

  // Table header click sort
  container.querySelectorAll('.event-table th[data-sort-key]').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.sortKey;
      let dir = 'asc';
      if (columnSort.key === key && columnSort.dir === 'asc') dir = 'desc';
      columnSort = { key, dir };
      currentPage = 1;
      applyFiltersAndRender(container, allData, currentPage, false);
    };
    th.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') th.click();
    };
  });
}

export async function renderApp(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = renderProgressBar(0) + '<div>Loading...</div>';
  allData = [];
  let loaded = 0;
  const total = 3; // adjust based on manifest
  await fetchAllData(async (flat, url, err) => {
    loaded++;
    const percent = Math.round((loaded / total) * 100);
    container.innerHTML = renderProgressBar(percent) + '<div>Loading...</div>';
    if (err) {
      container.innerHTML += `<div class="error">Failed to load ${url}: ${err}</div>`;
      return;
    }
    if (flat.length === 0) return;
    const enriched = await enrichData(flat);
    allData = allData.concat(enriched);
    if (loaded === total) {
      container.innerHTML =
        `<div class="sticky-bar">${renderSearchAndSort()}</div>
         <div id="events-list" class="centered-wrap"></div>`;
      updateExpansionOptions(allData);
      const eventsList = document.getElementById('events-list');
      currentPage = 1;
      applyFiltersAndRender(eventsList, allData, currentPage, false);

      // Hook up controls
      document.getElementById('search-input').addEventListener('input', () => {
        currentPage = 1;
        applyFiltersAndRender(eventsList, allData, currentPage, false);
      });
      document.getElementById('expansion-filter').addEventListener('change', () => {
        currentPage = 1;
        applyFiltersAndRender(eventsList, allData, currentPage, false);
      });
      document.getElementById('rarity-filter').addEventListener('change', () => {
        currentPage = 1;
        applyFiltersAndRender(eventsList, allData, currentPage, false);
      });
      document.getElementById('sort-filter').addEventListener('change', () => {
        currentPage = 1;
        columnSort = {}; // filter dropdown disables header sort
        applyFiltersAndRender(eventsList, allData, currentPage, false);
      });

      // Infinite scroll
      window.addEventListener('scroll', () => {
        if (isLoading) return;
        const containerHeight = document.documentElement.scrollHeight;
        const scrollPosition = window.scrollY + window.innerHeight;
        const searchTerm = document.getElementById('search-input').value;
        const expansion = document.getElementById('expansion-filter').value;
        const rarity = document.getElementById('rarity-filter').value;
        const sortKey = document.getElementById('sort-filter').value;
        const filteredEvents = filterEvents(allData, { searchTerm, expansion, rarity, sortKey });
        if (scrollPosition > containerHeight - 100) {
          if (filteredEvents.length > PAGE_SIZE * currentPage) {
            isLoading = true;
            currentPage++;
            applyFiltersAndRender(eventsList, allData, currentPage, true);
            isLoading = false;
          }
        }
      });

      // Help dialogue
      document.getElementById('side-help').addEventListener('click', () => {
        if (document.getElementById('modal-help')) return;
        const modal = document.createElement('div');
        modal.id = 'modal-help';
        Object.assign(modal.style, {
          position: 'fixed', top:0,left:0,right:0,bottom:0,background: 'rgba(24,32,54,.65)', display:'flex',alignItems:'center',justifyContent:'center',zIndex: 10000,
        });
        modal.innerHTML = `
          <div style="background:#fff;border-radius:10px;padding:2em 2.7em 2em 2.7em;max-width:410px;text-align:left;box-shadow:0 10px 40px #2343a633;">
            <h2 style="margin-top:0;font-size:1.2em">How to Use the Visualizer</h2>
            <ul style="margin:1em 0 1em 1em;">
              <li><strong>Search:</strong> Focus the bar with Tap/Click or <kbd>Tab</kbd>. Type to filter by event/map name.</li>
              <li><strong>Sort:</strong> Click a heading or use the sort dropdown to sort events. Use <kbd>Tab</kbd>, <kbd>Enter</kbd>.</li>
              <li><strong>Toggle sections:</strong> Access via <kbd>Tab</kbd> and <kbd>Enter</kbd>/<kbd>Space</kbd>.</li>
              <li><strong>Copy bar:</strong> Use <kbd>Tab</kbd> and <kbd>Enter</kbd> to copy event text; receives a "Copied!" indicator.</li>
              <li><strong>Deep links:</strong> Click 🔗 next to an event name to copy/share a direct link to that event.</li>
              <li><strong>Mobile:</strong> All controls are touch-friendly and swipeable.</li>
              <li><strong>Close:</strong> Click outside or press <kbd>Esc</kbd>.</li>
            </ul>
          </div>
        `;
        modal.tabIndex = -1;
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
        setTimeout(() => modal.focus(), 100);
        window.addEventListener('keydown', function onEscHelp(evt) {
          if (evt.key === 'Escape') { modal.remove(); window.removeEventListener('keydown', onEscHelp);}
        });
      });

    }
  });
}

renderApp('app');
