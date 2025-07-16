import { loadAndEnrichData } from 'https://geri0v.github.io/Gamers-Hell/js/infoload.js';
import { groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/info.js';
import {
  createCopyBar,
  createMostValuableBadge,
  getMostValuableDrop
} from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';
import { filterEvents } from 'https://geri0v.github.io/Gamers-Hell/js/search.js';
import { paginate } from 'https://geri0v.github.io/Gamers-Hell/js/pagination.js';

let allData = [];
let currentPage = 1;
let isLoading = false;
let columnSort = {};
const PAGE_SIZE = 20;

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

function trimTo2Sentences(text) {
  const sentenceMatch = text.match(/^(.+?[.!?])\s+(.+?[.!?])/);
  return sentenceMatch ? `${sentenceMatch[1]} ${sentenceMatch[2]}` : text;
}

function renderToolbar() {
  return `
    <div id="main-controls-wrap">
      <div class="toolbar-top">
        <button class="side-btn" id="side-help">❓</button>
        <input id="search-input" placeholder="Search event or map..."/>
        <button class="side-btn" id="readme-btn">📄 Readme</button>
      </div>
      <div class="filter-row">
        <input id="lootname-filter" placeholder="Loot name" />
        <input id="loottype-filter" placeholder="Type" />
        <input id="chatcode-filter" placeholder="Chatcode" />
      </div>
      <div class="filter-row">
        <select id="sort-filter">
          <option value="">Sort By</option>
          <option value="name">Name</option>
          <option value="map">Map</option>
          <option value="waypointName">Waypoint Name</option>
          <option value="code">Waypoint Code</option>
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
        <div class="subcard${l.guaranteed ? " guaranteed" : ""}${l === mostVal ? " most-valuable" : ""}">
          ${l.icon ? `<img src="${l.icon}" alt="">` : ''}
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
          <th data-sort-key="name">Name <span class="sort-arrow"></span></th>
          <th data-sort-key="map">Map <span class="sort-arrow"></span></th>
          <th data-sort-key="waypointName">Waypoint Name <span class="sort-arrow"></span></th>
          <th data-sort-key="code">Waypoint Code <span class="sort-arrow"></span></th>
        </tr>
      </thead>
      <tbody>
        ${events.map((e, idx) => {
          const eventId = `ev-${expIdx}-${srcIdx}-${idx}`;
          e.value = Math.max(...(e.loot || []).map(l => l.price ?? 0));
          return `
            <tr id="${eventId}">
              <td><a href="${e.wikiLink}" target="_blank">${e.name}</a></td>
              <td>${e.mapWikiLink ? `<a href="${e.mapWikiLink}" target="_blank">${e.map}</a>` : e.map}</td>
              <td>${e.waypointName && e.waypointWikiLink
                ? `<a href="${e.waypointWikiLink}" target="_blank">${e.waypointName}</a>`
                : (e.waypointName || '–')}</td>
              <td>${e.code || '–'}</td>
            </tr>
            <tr><td colspan="4">${createCopyBar(e)}</td></tr>
            ${e.description ? `<tr><td colspan="4"><div class="inline-desc"><strong>Description:</strong> ${trimTo2Sentences(e.description)} <a href="${e.wikiLink}" target="_blank">(see wiki)</a></div></td></tr>` : ''}
            <tr><td colspan="4">${renderLootCards(e.loot, eventId)}</td></tr>
            <tr><td colspan="4"><hr class="event-separator"></td></tr>
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
  const filters = getFiltersFromUI();
  let filtered = filterEvents(data, filters);

  if (filters.sortKey) {
    const { key, dir } = columnSort = { key: filters.sortKey, dir: columnSort.dir === 'asc' ? 'desc' : 'asc' };
    filtered = filtered.sort((a, b) => {
      if (key === 'value') return (dir === 'asc' ? 1 : -1) * ((a.value || 0) - (b.value || 0));
      return (a[key] || '').localeCompare(b[key] || '') * (dir === 'asc' ? 1 : -1);
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
      <h2 class="section-header">${exp.expansion}</h2>
      <div class="expansion-content"></div>
    `);
    exp.sources.forEach((src, srcIdx) => {
      const srcCard = createCard('source-card', `
        <h3 class="subsection-header">${src.sourcename}</h3>
        ${renderEventTable(src.items, srcIdx, expIdx)}
      `);
      expCard.querySelector('.expansion-content').appendChild(srcCard);
    });
    container.appendChild(expCard);
  });

  // Update sort arrows
  container.querySelectorAll('th[data-sort-key]').forEach(th => {
    const arrow = th.querySelector('.sort-arrow');
    const active = columnSort.key === th.dataset.sortKey;
    arrow.textContent = active ? (columnSort.dir === 'asc' ? '▲' : '▼') : '';
  });
}

export async function renderApp(containerId) {
  const appEl = document.getElementById(containerId);
  appEl.innerHTML = renderToolbar() + '<div id="events-list"></div>';
  const list = document.getElementById('events-list');

  allData = await loadAndEnrichData();
  updateExpansionOptions(allData);
  applyFiltersAndRender(list, allData, 1);

  [
    'search-input', 'lootname-filter', 'loottype-filter',
    'chatcode-filter', 'sort-filter', 'expansion-filter',
    'rarity-filter', 'guaranteedonly-filter', 'chanceonly-filter'
  ].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () =>
      applyFiltersAndRender(list, allData, 1)
    );
  });

  // README popup
  document.getElementById("readme-btn").addEventListener("click", async () => {
    if (document.getElementById('modal-readme')) return;
    const modal = document.createElement('div');
    modal.id = "modal-readme";
    modal.setAttribute("role", "dialog");
    modal.style = "position:fixed;inset:0;background:#0006;display:flex;justify-content:center;align-items:center;z-index:9999;";
    let text = 'Loading...';
    try {
      text = await fetch('https://geri0v.github.io/Gamers-Hell/README.md').then(r => r.text());
    } catch { text = 'Could not load README.'; }
    modal.innerHTML = `
      <div class="modal-content" style="max-height:80vh;overflow:auto; padding:2em;">
        <button class="copy-btn" onclick="this.closest('#modal-readme').remove()" style="float:right">Close</button>
        <h2>README</h2>
        <pre style="white-space:pre-wrap;">${text}</pre>
      </div>`;
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  });

  // Help modal
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
          <li>Use filters to explore loot events by name, map, or type.</li>
          <li>Click event names/maps for links to the GW2 wiki.</li>
          <li>All loot and descriptions are now always shown.</li>
        </ul>
        <button class="copy-btn" onclick="document.getElementById('modal-help').remove()">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  });

  // Infinite scroll: stops at last page
  window.addEventListener("scroll", () => {
    if (isLoading) return;
    const filters = getFiltersFromUI();
    const filtered = filterEvents(allData, filters);
    const bottom = window.scrollY + window.innerHeight >= document.body.offsetHeight - 150;
    if (bottom && filtered.length > PAGE_SIZE * currentPage) {
      isLoading = true;
      currentPage++;
      applyFiltersAndRender(list, allData, currentPage, true);
      isLoading = false;
    }
  });

  // Back to Top
  const scrollBtn = document.createElement("button");
  scrollBtn.className = "scroll-top-btn";
  scrollBtn.textContent = "⬆";
  scrollBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  document.body.appendChild(scrollBtn);
  window.addEventListener("scroll", () => {
    scrollBtn.style.display = window.scrollY > 500 ? "block" : "none";
  });
}
