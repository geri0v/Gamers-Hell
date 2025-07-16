// search.js
// GW2 Deep-Dive Event Browser: Search & Filter System

/**
 * Filters an array of enriched events using multiple criteria and loot tag flags.
 *
 * @param {Array} events - Enriched event objects from eventdata.js
 * @param {Object} filters - {
 *   searchTerm, expansion, map, eventName, rarity, lootType
 * }
 * @returns {Array}
 */
export function filterEvents(events, filters = {}) {
  return events.filter(event => {
    // Text search (event name + loot item names)
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase();
      const inName = event.name && event.name.toLowerCase().includes(term);
      const inLoot = (event.loot || []).some(i => i.name?.toLowerCase().includes(term));
      if (!inName && !inLoot) return false;
    }

    // Expansion filter
    if (filters.expansion && filters.expansion !== '' && event.expansion !== filters.expansion) return false;

    // Map filter
    if (filters.map && filters.map !== '' && event.map !== filters.map) return false;

    // Event name (exact)
    if (filters.eventName && filters.eventName !== '' && event.name !== filters.eventName) return false;

    // Loot rarity filter (event must have at least one matching item)
    if (filters.rarity && filters.rarity !== '') {
      const hasRarity = (event.loot || []).some(
        item => item.rarity && item.rarity.toLowerCase() === filters.rarity.toLowerCase()
      );
      if (!hasRarity) return false;
    }

    // Advanced loot tag filter (guaranteed, collectible, achievement)
    if (filters.lootType && filters.lootType !== '') {
      switch (filters.lootType) {
        case 'guaranteed':
          if (!event.loot?.some(i => i.guaranteed)) return false;
          break;
        case 'collectible':
          if (!event.loot?.some(i => i.collectible)) return false;
          break;
        case 'achievement':
          if (!event.loot?.some(i => i.achievementLinked)) return false;
          break;
        default:
          break;
      }
    }
    return true;
  });
}

/**
 * Renders interactive sort buttons for use with the event browser.
 *
 * @param {Function} onSortSelected - Callback receiving the selected sort key
 * @returns {HTMLElement} - A container with sort buttons
 */
export function renderSortButtons(onSortSelected) {
  const container = document.createElement('div');
  container.className = 'sort-bar';

  const btns = [
    { key: 'name', label: 'Sort by Name' },
    { key: 'map', label: 'Sort by Map' },
    { key: 'value', label: 'Sort by Value' }
  ];

  btns.forEach(({ key, label }) => {
    const btn = document.createElement('button');
    btn.className = 'sort-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => onSortSelected(key));
    container.appendChild(btn);
  });

  return container;
}

/**
 * (Optional) Renders a filter bar with expansion, map, event name, rarity, and loot type selectors.
 * Supply arrays of option values and a callback to handle filter changes.
 *
 * Example for integration in visual.js.
 */
export function renderFilterBar({ expansions = [], maps = [], eventNames = [], rarities = [], current = {} }, onFilterChange) {
  // Helper to make <option> elements from values
  const makeOptions = (list, selected) => list.map(opt => {
    const o = document.createElement('option');
    o.value = opt.val;
    o.textContent = opt.text;
    if (selected === opt.val) o.selected = true;
    return o;
  });

  const bar = document.createElement('div');
  bar.className = 'filter-bar';

  // Expansion
  const expansionSel = document.createElement('select');
  expansionSel.innerHTML = `<option value="">Expansion</option>`;
  makeOptions(expansions, current.expansion).forEach(o => expansionSel.appendChild(o));
  expansionSel.onchange = e => onFilterChange('expansion', e.target.value);
  bar.appendChild(expansionSel);

  // Map
  const mapSel = document.createElement('select');
  mapSel.innerHTML = `<option value="">Map</option>`;
  makeOptions(maps, current.map).forEach(o => mapSel.appendChild(o));
  mapSel.onchange = e => onFilterChange('map', e.target.value);
  bar.appendChild(mapSel);

  // Event name
  const eventSel = document.createElement('select');
  eventSel.innerHTML = `<option value="">Event</option>`;
  makeOptions(eventNames, current.eventName).forEach(o => eventSel.appendChild(o));
  eventSel.onchange = e => onFilterChange('eventName', e.target.value);
  bar.appendChild(eventSel);

  // Rarity
  const raritySel = document.createElement('select');
  raritySel.innerHTML = `<option value="">Rarity</option>`;
  makeOptions(rarities, current.rarity).forEach(o => raritySel.appendChild(o));
  raritySel.onchange = e => onFilterChange('rarity', e.target.value);
  bar.appendChild(raritySel);

  // Loot tag
  const lootTags = [
    { val: '', text: 'Loot Type' },
    { val: 'guaranteed', text: 'Guaranteed' },
    { val: 'collectible', text: 'Collectible' },
    { val: 'achievement', text: 'Achievement' }
  ];
  const lootTypeSel = document.createElement('select');
  lootTags.forEach(l => {
    const o = document.createElement('option');
    o.value = l.val;
    o.textContent = l.text;
    if (current.lootType === l.val) o.selected = true;
    lootTypeSel.appendChild(o);
  });
  lootTypeSel.onchange = e => onFilterChange('lootType', e.target.value);
  bar.appendChild(lootTypeSel);

  return bar;
}

/**
 * (Optional) Renders the search bar for term queries.
 * @param {Function} onSearch - callback with string (new searchTerm)
 * @returns {HTMLElement}
 */
export function renderSearchBar(onSearch) {
  const container = document.createElement('div');
  container.className = 'search-bar';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search events or loot...';
  input.addEventListener('input', e => onSearch(e.target.value));
  container.appendChild(input);
  return container;
}
