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
  // Load each file and collect all source objects
  const sourceObjects = [];
  for (const urls of Object.values(files)) {
    const source = await tryFetch(urls);
    // If the file is an array (already in new format), merge all expansions
    if (Array.isArray(source)) {
      sourceObjects.push(...source);
    } else {
      // If the file is a single source object, push it
      sourceObjects.push(source);
    }
  }

  // Merge sources into expansions
  const expansionsMap = {};
  for (const source of sourceObjects) {
    // Determine expansion name (from object or first event)
    let expansionName = source.expansion;
    if (!expansionName && Array.isArray(source.events) && source.events.length > 0) {
      expansionName = source.events[0].expansion;
    }
    if (!expansionName) expansionName = 'Unknown Expansion';

    // Create expansion group if not present
    if (!expansionsMap[expansionName]) {
      expansionsMap[expansionName] = { expansion: expansionName, sources: [] };
    }
    expansionsMap[expansionName].sources.push({
      sourceName: source.sourceName || 'Unknown Source',
      events: Array.isArray(source.events) ? source.events : []
    });
  }
  // Return as array for render.js
  return Object.values(expansionsMap);
}
