// https://geri0v.github.io/Gamers-Hell/js/render.js

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

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

function createToggleButton(label, targetId) {
  return `<button class="toggle-btn" data-target="${targetId}" aria-expanded="false">${label}</button>`;
}

function renderLoot(loot, eventId) {
  if (!Array.isArray(loot) || loot.length === 0) return '';
  const lootId = `loot-${eventId}`;
  return `
    ${createToggleButton('Show', lootId)}
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
        ${events.map((item, itemIdx) => {
          const eventId = `event-${expIdx}-${sourceIdx}-${itemIdx}`;
          return `
            <tr>
              <td>
                ${item.wikiLink ? `<a href="${item.wikiLink}" target="_blank">${item.name}</a>` : item.name}
              </td>
              <td>
                ${item.mapWikiLink ? `<a href="${item.mapWikiLink}" target="_blank">${item.map}</a>` : item.map}
              </td>
              <td>
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
                ${renderLoot(item.loot, eventId)}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderSearchBar() {
  return `
    <div class="search-bar">
      <input id="search-input" type="text" placeholder="Search event or map..." />
      <select id="expansion-filter"><option value="">All Expansions</option></select>
      <select id="rarity-filter">
        <option value="">All Rarities</option>
        <option value="Ascended">Ascended</option>
        <option value="Exotic">Exotic</option>
        <option value="Rare">Rare</option>
        <option value="Masterwork">Masterwork</option>
        <option value="Fine">Fine</option>
        <option value="Basic">Basic</option>
      </select>
      <select id="sort-filter">
        <option value="">Sort By</option>
        <option value="name">Name</option>
        <option value="expansion">Expansion</option>
        <option value="map">Map</option>
        <option value="value">Value</option>
      </select>
    </div>
  `;
}

function updateExpansionOptions(events) {
  const exps = [...new Set(events.map(e => e.expansion))].sort();
  const select = document.getElementById('expansion-filter');
  select.innerHTML = `<option value="">All Expansions</option>` +
    exps.map(exp => `<option value="${exp}">${exp}</option>`).join('');
}

function applyFiltersAndRender(container, allEvents, pageNumber = 1, append = false) {
  const searchTerm = document.getElementById('search-input').value;
  const expansion = document.getElementById('expansion-filter').value;
  const rarity = document.getElementById('rarity-filter').value;
  const sortKey = document.getElementById('sort-filter').value;
  const filteredEvents = filterEvents(allEvents, { searchTerm, expansion, rarity, sortKey });
  const pagedEvents = paginate(filteredEvents, PAGE_SIZE, pageNumber);
  const grouped = groupAndSort(pagedEvents);

  if (!append) {
    container.innerHTML = '';
  }

  grouped.forEach((exp, expIdx) => {
    const expId = `expansion-${expIdx}`;
    const expDiv = createCard('expansion-card', `
      ${createToggleButton('Show/Hide', expId)}
      <h2>${exp.expansion}</h2>
      <div class="expansion-content" id="${expId}"></div>
    `);
    exp.sources.forEach((src, srcIdx) => {
      const srcId = `source-${expIdx}-${srcIdx}`;
      const srcDiv = createCard('source-card', `
        ${createToggleButton('Show/Hide', srcId)}
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
}

function renderProgressBar(percent) {
  return `
    <div class="progress-bar-container">
      <div class="progress-bar" style="width:${percent}%;"></div>
    </div>
  `;
}

export async function renderApp(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = renderProgressBar(0) + '<div>Loading...</div>';
  allData = [];
  let loaded = 0;
  const total = 3; // Adjust if you change the number of JSON files

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
      container.innerHTML = renderSearchBar() + `<div id="events-list"></div>`;
      updateExpansionOptions(allData);
      const eventsList = document.getElementById('events-list');
      currentPage = 1;
      applyFiltersAndRender(eventsList, allData, currentPage, false);

      // Search/filter/sort event handlers
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
    }
  });
}

renderApp('app');
