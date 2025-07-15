// https://geri0v.github.io/Gamers-Hell/js/search.js

export function filterEvents(events, { searchTerm, expansion, rarity, sortKey }) {
  let filtered = events;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(e =>
      (e.name && e.name.toLowerCase().includes(term)) ||
      (e.map && e.map.toLowerCase().includes(term))
    );
  }
  if (expansion) {
    filtered = filtered.filter(e => e.expansion === expansion);
  }
  if (rarity) {
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => l.rarity === rarity)
    );
  }
  if (sortKey) {
    filtered = filtered.slice().sort((a, b) => {
      const aVal = (a[sortKey] || '').toLowerCase();
      const bVal = (b[sortKey] || '').toLowerCase();
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
  }
  return filtered;
}
