// search.js
// Flexible search and filter interface for deep-dive GW2 event browser

/**
 * Filters events array using multiple criteria and loot tags.
 * @param {Array} events - Array of enriched event objects.
 * @param {Object} filters - { searchTerm, expansion, map, eventName, rarity, lootType }
 * @returns {Array} - Filtered events.
 */
export function filterEvents(events, filters) {
  return events.filter(event => {
    // Search string match
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      const inEvent = event.name.toLowerCase().includes(term);
      const inLoot = (event.loot || []).some(i => i.name.toLowerCase().includes(term));
      if (!inEvent && !inLoot) return false;
    }

    // Expansion
    if (filters.expansion && event.expansion !== filters.expansion) return false;

    // Map
    if (filters.map && event.map !== filters.map) return false;

    // Event name
    if (filters.eventName && event.name !== filters.eventName) return false;

    // Loot rarity (at least one match)
    if (filters.rarity) {
      const match = (event.loot || []).some(i => i.rarity?.toLowerCase() === filters.rarity.toLowerCase());
      if (!match) return false;
    }

    // Loot tag filters
    if (filters.lootType) {
      const tag = filters.lootType;
      if (tag === 'guaranteed') {
        if (!event.loot?.some(i => i.guaranteed)) return false;
      } else if (tag === 'collectible') {
        if (!event.loot?.some(i => i.collectible)) return false;
      } else if (tag === 'achievement') {
        if (!event.loot?.some(i => i.achievementLinked)) return false;
      }
    }

    return true;
  });
}

/**
 * Renders sort buttons.
 * @param {Function} onSortSelected — callback with sort key: name/map/value
 */
export function renderSortButtons(onSortSelected) {
  const container = document.createElement('div');
  container.className = 'sort-bar';

  const buttons = [
    { key: 'name', label: 'Sort: Name' },
    { key: 'map', label: 'Sort: Map' },
    { key: 'value', label: 'Sort: Value' }
  ];

  buttons.forEach(({ key, label }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'sort-btn';
    btn.onclick = () => onSortSelected(key);
    container.appendChild(btn);
  });

  return container;
}

/**
 * Renders the filter bar UI.
 * @param {Object} options - lists of filter values
 * @param {Function} onFilterChange - callback for changes
 */
export function renderFilterBar({ expansions, maps, eventNames, rarities, current = {} }, onFilterChange) {
  const bar = document.createElement('div');
  bar.className = 'filter-bar';

  const categories = [
    { label: 'Expansion', key: 'expansion', options: expansions },
    { label: 'Map', key: 'map', options: maps },
    { label: 'Event', key: 'eventName', options: eventNames },
    { label: 'Rarity', key: 'rarity', options: rarities },
    {
      label: 'Loot Type', key: 'lootType', options: [
        { val: '', text: 'Loot Type' },
        { val: 'guaranteed', text: 'Guaranteed' },
        { val: 'collectible', text: 'Collectible' },
        { val: 'achievement', text: 'Achievement' }
      ]
    }
  ];

  function makeOptions(optList, selected, label) {
    const sel = document.createElement('select');
    sel.innerHTML = `<option value="">${label}</option>`;
    optList.forEach(opt => {
      const isObj = typeof opt === 'object';
      const val = isObj ? opt.val : opt;
      const text = isObj ? opt.text : opt;
      const o = document.createElement('option');
      o.value = val;
      o.textContent = text;
      if (selected === val) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  categories.forEach(({ label, key, options }) => {
    const sel = makeOptions(options, current[key], label);
    sel.onchange = e => onFilterChange(key, e.target.value);
    bar.appendChild(sel);
  });

  return bar;
}

/**
 * Renders a search bar (text input).
 * @param {Function} onSearch — callback when text is typed
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
