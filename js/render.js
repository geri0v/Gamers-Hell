// https://geri0v.github.io/Gamers-Hell/js/render.js

import { fetchAllData, groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichData, formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/loader.js';
import { createCopyBar, getMostValuableDrop } from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';
import { setupToggles } from 'https://geri0v.github.io/Gamers-Hell/js/toggle.js';
import { filterEvents } from 'https://geri0v.github.io/Gamers-Hell/js/search.js';
import { paginate } from 'https://geri0v.github.io/Gamers-Hell/js/pagination.js';

const PAGE_SIZE = 20;
let currentPage = 1;
let allEvents = [];
let filteredEvents = [];
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

function renderProgressBar(percent) {
  return `
    <div class="progress-bar-container">
      <div class="progress-bar" style="width:${percent}%;"></div>
    </div>
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

function renderEvents(events, container, append = false) {
  if (!append) container.innerHTML = '';
  events.forEach((item, idx) => {
    const eventId = `event-${idx}`;
    const details = Object.entries(item)
      .filter(([k]) => k !== 'loot' && k !== 'expansion' && k !== 'sourcename')
      .map(([k, v]) => {
        if (k === 'wikiLink' && v) return `<div><strong>Wiki:</strong> <a href="${v}" target="_blank">${item.name}</a></div>`;
        if (k === 'mapWikiLink' && v) return `<div><strong>Map Wiki:</strong> <a href="${v}" target="_blank">${item.map}</a></div>`;
        return `<div><strong>${k}:</strong> ${Array.isArray(v) ? JSON.stringify(v) : v}</div>`;
      })
      .join('');
    const lootSection = renderLoot(item.loot, eventId);
    const copyBar = createCopyBar(item);
    const itemDiv = createCard('item-card', `<div>${details}${lootSection}${copyBar}</div>`);
    container.appendChild(itemDiv);
  });
}

function applyFiltersAndRender(container) {
  const searchTerm = document.getElementById('search-input').value;
  const expansion = document.getElementById('expansion-filter').value;
  const rarity = document.getElementById('rarity-filter').value;
  const sortKey = document.getElementById('sort-filter').value;
  filteredEvents = filterEvents(allEvents, { searchTerm, expansion, rarity, sortKey });
  currentPage = 1;
  renderEvents(paginate(filteredEvents, PAGE_SIZE, currentPage), container);
}

export async function renderApp(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = renderProgressBar(0) + '<div>Loading...</div>';
  let loaded = 0;

  let progressPercent = 0;
  await fetchAllData(async (flat, url, err) => {
    loaded++;
    progressPercent = Math.round((loaded / 3) * 100);
    container.innerHTML = renderProgressBar(progressPercent) + '<div>Loading...</div>';
    if (err) {
      container.innerHTML += `<div class="error">Failed to load ${url}: ${err}</div>`;
      return;
    }
    if (flat.length === 0) return;
    const enriched = await enrichData(flat);
    allEvents = allEvents.concat(enriched);

    if (loaded === 3) {
      container.innerHTML = renderSearchBar() + `<div id="events-list" class="expansion-content"></div>`;
      updateExpansionOptions(allEvents);
      filteredEvents = allEvents;
      const eventsList = document.getElementById('events-list');
      renderEvents(paginate(filteredEvents, PAGE_SIZE, currentPage), eventsList);

      document.getElementById('search-input').addEventListener('input', () => applyFiltersAndRender(eventsList));
      document.getElementById('expansion-filter').addEventListener('change', () => applyFiltersAndRender(eventsList));
      document.getElementById('rarity-filter').addEventListener('change', () => applyFiltersAndRender(eventsList));
      document.getElementById('sort-filter').addEventListener('change', () => applyFiltersAndRender(eventsList));

      window.addEventListener('scroll', () => {
        if (isLoading) return;
        const eventsList = document.getElementById('events-list');
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
          if (filteredEvents.length > PAGE_SIZE * currentPage) {
            isLoading = true;
            currentPage += 1;
            renderEvents(paginate(filteredEvents, PAGE_SIZE, currentPage), eventsList, true);
            isLoading = false;
          }
        }
      });

      setupToggles();
    }
  });
}

renderApp('app');
