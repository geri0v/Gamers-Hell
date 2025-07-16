import { filterEventsExtended } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

/**
 * Basic fuzzy matching (term matches character order loosely)
 */
function fuzzyMatch(str = '', pattern = '') {
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

/**
 * Perform enriched event filtering
 * @param {Array} events - Event objects to filter
 * @param {Object} filters - All filter states from UI
 */
export function filterEvents(events, filters) {
  const { searchTerm, ...rest } = filters;

  let subset = events;

  if (searchTerm && searchTerm.trim().length) {
    const term = searchTerm.trim();
    subset = events.filter(e =>
      fuzzyMatch(e.name || '', term) || fuzzyMatch(e.map || '', term)
    );
  }

  return filterEventsExtended(subset, rest);
}
