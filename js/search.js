// search.js
import { filterEventsExtended } from './data.js';

// Search bar rendering (type="text", always usable)
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

// Filter bar rendering with event dropdown
export function renderFilterBar(options, onChange) {
  const container = document.createElement('div');
  container.className = 'filter-bar';

  // Helper: dropdown select
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

  select('Expansion', options.expansions, 'expansion', options.current.expansion);
  // Event selector (optional, place between expansion and rarity)
  if (options.events && options.events.length) {
    select('Event', options.events, 'eventName', options.current.eventName);
  }
  select('Rarity', options.rarities, 'rarity', options.current.rarity);
  select('Loot Type', [
    { val: '', text: 'All Loot' },
    { val: 'guaranteed', text: 'Guaranteed Only' },
    { val: 'chance', text: 'Chance Only' }
  ], 'lootType', options.current.lootType);

  return container;
}

// Sort buttons rendering
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

// Fuzzy matching utility
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

// Main event filtering function
export function filterEvents(events, filters) {
  let subset = events;
  const { searchTerm, lootType, expansion, rarity, itemType, eventName, ...rest } = filters;

  // Search term (fuzzy match on name or map)
  if (searchTerm && searchTerm.trim().length) {
    const term = searchTerm.trim();
    subset = subset.filter(e =>
      fuzzyMatch(e.name || '', term) ||
      fuzzyMatch(e.map || '', term)
    );
  }

  // Event dropdown filter (exact match)
  if (eventName && eventName.trim().length) {
    subset = subset.filter(e => (e.name || '') === eventName);
  }

  // Loot type filter
  if (lootType === 'guaranteed') {
    subset = subset.filter(e => (e.loot || []).some(i => i.guaranteed === true));
  } else if (lootType === 'chance') {
    subset = subset.filter(e => (e.loot || []).some(i => i.guaranteed !== true));
  }

  // Pass remaining filters to data.js extended filter
  return filterEventsExtended(subset, {
    expansion, rarity, itemType,
    ...rest
  });
}
