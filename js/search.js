// search.js
import { filterEventsExtended } from './data.js';

// === Render Search Bar ===
export function renderSearchBar(onSearch) {
  const wrap = document.createElement('div');
  wrap.className = 'search-bar';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search events or maps...';
  input.autocomplete = 'off';
  input.value = '';
  input.addEventListener('input', e => onSearch(e.target.value));
  wrap.appendChild(input);

  return wrap;
}

// === Render Filter Bar ===
export function renderFilterBar(options, onChange) {
  const container = document.createElement('div');
  container.className = 'filter-bar';

  // Helper for select box
  const select = (label, list, key, current) => {
    const wrap = document.createElement('label');
    wrap.className = 'filter-item';
    wrap.textContent = `${label}: `;

    const dropdown = document.createElement('select');
    list.forEach(({ val, text }) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      if (val === current) opt.selected = true;
      dropdown.appendChild(opt);
    });
    dropdown.addEventListener('change', e => onChange(key, e.target.value));
    wrap.appendChild(dropdown);
    container.appendChild(wrap);
  };

  // === ORDER: Expansion | Event | Rarity | Loot Type ===
  select('Expansion', options.expansions, 'expansion', options.current.expansion);

  if (options.events && options.events.length) {
    select(
      'Event',
      [{ val: '', text: 'All Events' }, ...options.events],
      'eventName',
      options.current.eventName
    );
  }

  select('Rarity', options.rarities, 'rarity', options.current.rarity);

  select('Loot Type', [
    { val: '', text: 'All Loot' },
    { val: 'guaranteed', text: 'Guaranteed Only' },
    { val: 'chance', text: 'Chance Only' }
  ], 'lootType', options.current.lootType);

  return container;
}

// === Render Sort Buttons ===
export function renderSortButtons(onSort) {
  const sortWrap = document.createElement('div');
  sortWrap.className = 'sort-bar';

  ['Name', 'Map', 'Value'].forEach(key => {
    const btn = document.createElement('button');
    btn.textContent = `Sort by ${key}`;
    btn.className = 'sort-btn';
    btn.addEventListener('click', () => onSort(key.toLowerCase()));
    sortWrap.appendChild(btn);
  });

  return sortWrap;
}

// === Fuzzy Matching ===
export function fuzzyMatch(str, pattern) {
  str = (str || '').toLowerCase();
  pattern = (pattern || '').toLowerCase();
  let patternIdx = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === pattern[patternIdx]) {
      patternIdx++;
      if (patternIdx === pattern.length) return true;
    }
  }
  return false;
}

// === Filter Events Main Logic ===
export function filterEvents(events, filters) {
  let subset = events;
  const {
    searchTerm, lootType, expansion, rarity, itemType, eventName, ...rest
  } = filters;

  // Fuzzy search on event name or map
  if (searchTerm && searchTerm.trim().length) {
    const term = searchTerm.trim();
    subset = subset.filter(e =>
      fuzzyMatch(e.name || '', term) ||
      fuzzyMatch(e.map || '', term)
    );
  }

  // Event name filter (dropdown selection)
  if (eventName && eventName.trim()) {
    subset = subset.filter(e => (e.name || '') === eventName);
  }

  // Loot type filtering
  if (lootType === 'guaranteed') {
    subset = subset.filter(e => (e.loot || []).some(i => i.guaranteed === true));
  } else if (lootType === 'chance') {
    subset = subset.filter(e => (e.loot || []).some(i => i.guaranteed !== true));
  }

  // Pass remaining filters to extended logic
  return filterEventsExtended(subset, {
    expansion, rarity, itemType,
    ...rest
  });
}
