// search.js
import { getMostValuableDrop } from './copy.js';

export function filterEvents(events, { searchTerm, expansion, rarity, sortKey }) {
  let filtered = events;
  if (searchTerm) {
    filtered = filtered.filter(ev =>
      ev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.map.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  if (expansion) {
    filtered = filtered.filter(ev => ev.expansion === expansion);
  }
  if (rarity) {
    filtered = filtered.filter(ev =>
      ev.loot && ev.loot.some(item => item.rarity === rarity)
    );
  }
  if (sortKey) {
    filtered = filtered.slice().sort((a, b) => {
      if (sortKey === 'value') {
        return (getMostValuableDrop(b.loot)?.price || 0) - (getMostValuableDrop(a.loot)?.price || 0);
      }
      return (a[sortKey] || '').localeCompare(b[sortKey] || '');
    });
  }
  return filtered;
}
