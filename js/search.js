// https://geri0v.github.io/Gamers-Hell/js/search.js

import { getMostValuableDrop } from 'https://geri0v.github.io/Gamers-Hell/js/copy.js';

// Filters and sorts the list of events based on user input
export function filterEvents(events, { searchTerm, expansion, rarity, sortKey }) {
  let filtered = events;

  // Text search (event name or map)
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(ev =>
      (ev.name && ev.name.toLowerCase().includes(term)) ||
      (ev.map && ev.map.toLowerCase().includes(term))
    );
  }

  // Filter by expansion
  if (expansion) {
    filtered = filtered.filter(ev => ev.expansion === expansion);
  }

  // Filter by loot rarity
  if (rarity) {
    filtered = filtered.filter(ev =>
      Array.isArray(ev.loot) && ev.loot.some(item => item.rarity === rarity)
    );
  }

  // Sorting
  if (sortKey) {
    filtered = filtered.slice(); // to avoid mutating original
    filtered.sort((a, b) => {
      if (sortKey === 'value') {
        // Sort by most valuable drop (descending)
        return (getMostValuableDrop(b.loot)?.price || 0) - (getMostValuableDrop(a.loot)?.price || 0);
      }
      // Sort by string keys (name, expansion, map)
      return ((a[sortKey] || '') + '').localeCompare((b[sortKey] || '') + '');
    });
  }

  return filtered;
}
