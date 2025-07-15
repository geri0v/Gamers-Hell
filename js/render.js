import { fetchAllData, groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichData, formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/loader.js';
import { createCopyBar } from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';
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

// (Documented in earlier messages, see your shared working version for the rest. This includes rendering event tables, loot cards, copy bar, etc.)

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('app');
  container.innerHTML = '<div class="loader">Loading data...</div>';

  allData = [];
  let loaded = 0;
  const flatAllData = await fetchAllData();
  const enriched = await enrichData(flatAllData, null, ghdvLang);
  allData = enriched;

  container.innerHTML = renderSearchAndSort() + '<div id="events-list" class="centered-wrap"></div>';

  // Add your rendering logic below (expanded from your original render.js)
  // This redraws all UI and binds events after enrichment.

  setupToggles();
});
