// js/data.js

// Helper: Try each URL in order, return JSON from the first that works
async function tryFetch(urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (e) {
      // Try next URL
    }
  }
  throw new Error("All sources failed: " + urls.join(', '));
}

// List all your JSON sources here (add more as needed)
const files = {
  temples: [
    'https://geri0v.github.io/Gamers-Hell/json/core/temples.json'
  ],
  untimedcore: [
    'https://geri0v.github.io/Gamers-Hell/json/core/untimedcore.json'
  ]
};

// Main loader: merges all sources into a single array of expansions
export async function loadAllData() {
  // Fetch all sources in parallel
  const fetchPromises = Object.values(files).map(urls =>
    tryFetch(urls).catch(e => {
      console.warn('Failed to load:', urls, e);
      return null;
    })
  );
  const results = await Promise.all(fetchPromises);
  const validResults = results.filter(r => r !== null);

  // Merge sources into expansions
  const expansionsMap = {};
  for (const source of validResults) {
    // Defensive: skip if not an object
    if (!source || typeof source !== 'object') continue;

    let expansionName = source.expansion;
    if (!expansionName && Array.isArray(source.events) && source.events.length > 0) {
      expansionName = source.events[0].expansion;
    }
    if (!expansionName) expansionName = 'Unknown Expansion';

    if (!expansionsMap[expansionName]) {
      expansionsMap[expansionName] = { expansion: expansionName, sources: [] };
    }
    expansionsMap[expansionName].sources.push({
      sourceName: source.sourceName || 'Unknown Source',
      events: Array.isArray(source.events) ? source.events : []
    });
  }
  return Object.values(expansionsMap);
}
