// data.js

// List all your JSON URLs here, or generate this array dynamically if needed.
const JSON_URLS = [
  'https://geri0v.github.io/Gamers-Hell/json/core/temples.json',
  'https://geri0v.github.io/Gamers-Hell/json/core/untimedcore.json',
  // Add more URLs as needed
];

// Helper to flatten the nested structure
function flatten(dataArr) {
  const flat = [];
  dataArr.forEach(expansionObj => {
    const expansion = expansionObj.expansion || 'Unknown Expansion';
    (expansionObj.sources || []).forEach(sourceObj => {
      const sourcename = sourceObj.sourceName || 'Unknown Source';
      (sourceObj.events || []).forEach(eventObj => {
        flat.push({
          expansion,
          sourcename,
          ...eventObj
        });
      });
    });
  });
  return flat;
}

export async function fetchAllData() {
  // Fetch all JSONs in parallel
  const results = await Promise.all(
    JSON_URLS.map(url =>
      fetch(url)
        .then(res => res.json())
        .catch(() => []) // If a file fails, skip it
    )
  );
  // Flatten and combine all results
  return results.flatMap(flatten);
}

// Group and sort by expansion, then by sourcename
export function groupAndSort(data) {
  const grouped = {};
  data.forEach(item => {
    const exp = item.expansion || 'Unknown Expansion';
    const src = item.sourcename || 'Unknown Source';
    if (!grouped[exp]) grouped[exp] = {};
    if (!grouped[exp][src]) grouped[exp][src] = [];
    grouped[exp][src].push(item);
  });

  return Object.keys(grouped).sort().map(expansion => ({
    expansion,
    sources: Object.keys(grouped[expansion]).sort().map(sourcename => ({
      sourcename,
      items: grouped[expansion][sourcename]
    }))
  }));
}
