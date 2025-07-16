// search.js
import { filterEventsExtended } from './data.js';

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

export function renderFilterBar(options, onChange) {
  const container = document.createElement('div');
  container.className = 'filter-bar';

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
  select('Rarity', options.rarities, 'rarity', options.current.rarity);
  select('Loot Type', [
    { val: '', text: 'All' },
    { val: 'guaranteed', text: 'Guaranteed Only' },
    { val: 'chance', text: 'Chance Only' }
  ], 'lootType', options.current.lootType);

  return container;
}

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

export function filterEvents(events, filters) {
  const { searchTerm, lootType, ...rest } = filters;

  let subset = events;

  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    subset = events.filter(e =>
      fuzzyMatch(e.name || '', term) ||
      fuzzyMatch(e.map || '', term)
    );
  }

  if (lootType === 'guaranteed') rest.guaranteedOnly = true;
  if (lootType === 'chance') rest.chanceOnly = true;

  return filterEventsExtended(subset, rest);
}

export function fuzzyMatch(str, pattern) {
  str = str.toLowerCase();
  pattern = pattern.toLowerCase();
  let patternIdx = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === pattern[patternIdx]) {
      patternIdx++;
      if (patternIdx === pattern.length) return true;
    }
  }
  return false;
}
