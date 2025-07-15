import { filterEventsExtended } from './data.js';

// Simple fuzzy search helper (typo-tolerance)
function fuzzyMatch(str, pattern) {
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

export function filterEvents(events, filters) {
  const { searchTerm, expansion, rarity, lootName, itemType, vendorValueMin, vendorValueMax, chatcode, guaranteedOnly, chanceOnly, sortKey } = filters;
  let filtered = events;
  if (searchTerm) {
    filtered = filtered.filter(e =>
      fuzzyMatch(e.name || '', searchTerm) ||
      fuzzyMatch(e.map || '', searchTerm)
    );
  }
  filtered = filterEventsExtended(filtered, { expansion, rarity, lootName, itemType, vendorValueMin, vendorValueMax, chatcode, guaranteedOnly, chanceOnly, sortKey });
  return filtered;
}
