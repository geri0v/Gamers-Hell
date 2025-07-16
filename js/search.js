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
    // Search term on event name or loot items
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      const inEvent = event.name.toLowerCase().includes(term);
      const inLoot = (event.loot || []).some(i => i.name.toLowerCase().includes(term));
      if (!inEvent && !inLoot) return false;
    }
    // Expansion
    if (filters.expansion && filters.expansion !== '' && event.expansion !== filters.expansion) return false;
    // Map
    if (filters.map && filters.map !== '' && event.map !== filters.map) return false;
    // Event name
    if (filters.eventName && filters.eventName !== '' && event.name !== filters.eventName) return false;
    // Rarity filter
    if (filters.rarity && filters.rarity !== '') {
      const hasRarity = (event.loot || []).some(item => {
        return item.rarity && item.rarity.toLowerCase() === filters.rarity.toLowerCase();
      });
      if (!hasRarity) return false;
    }
    // Loot type: guaranteed, collectible, achievement
    if (filters.lootType && filters.lootType !== '') {
      switch (filters.lootType) {
        case 'guaranteed':
          if (!event.loot || !event.loot.some(item => item.guaranteed)) return false;
          break;
        case 'collectible':
          if (!event.loot || !event.loot.some(item => item.collectible)) return false;
          break;
        case 'achievement':
          if (!event.loot || !event.loot.some(item => item.achievementLinked)) return false;
          break;
        default:
          break;
      }
    }
    return true;
  });
}

/**
 * ✅ Now Exported: renderSortButtons()
 * Renders sort buttons for name, map, and value.
 * @param {Function} onSortSelected - callback with selected sort key
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
