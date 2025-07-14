// https://geri0v.github.io/Gamers-Hell/js/search.js

import { getMostValuableDrop } from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';

export function filterEvents(events, { searchTerm, expansion, rarity, sortKey }) {
  let filtered = events;

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(ev =>
      (ev.name && ev.name.toLowerCase().includes(term)) ||
      (ev.map && ev.map.toLowerCase().includes(term))
    );
  }

  if (expansion) {
    filtered = filtered.filter(ev => ev.expansion === expansion);
  }

  if (rarity) {
    filtered = filtered.filter(ev =>
      Array.isArray(ev.loot) && ev.loot.some(item => item.rarity === rarity)
    );
  }

  if (sortKey) {
    filtered = filtered.slice();
    filtered.sort((a, b) => {
      if (sortKey === 'value') {
        return (getMostValuableDrop(b.loot)?.price || 0) - (getMostValuableDrop(a.loot)?.price || 0);
      }
      return ((a[sortKey] || '') + '').localeCompare((b[sortKey] || '') + '');
    });
  }

  return filtered;
}
