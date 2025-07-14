// data.js
export async function fetchAllData() {
  const urls = [
    'https://geri0v.github.io/Gamers-Hell/json/core/temples.json',
    'https://geri0v.github.io/Gamers-Hell/json/core/untimedcore.json'
  ];

  // Fetch both JSONs in parallel
  const results = await Promise.all(urls.map(url => fetch(url).then(res => res.json())));

  // Flatten the nested structure: expansion -> sources[] -> events[]
  function flatten(dataArr) {
    const flat = [];
    dataArr.forEach(expansionObj => {
      const expansion = expansionObj.expansion || 'Unknown Expansion';
      (expansionObj.sources || []).forEach(sourceObj => {
        const sourcename = sourceObj.sourceName || 'Unknown Source';
        (sourceObj.events || []).forEach(eventObj => {
          // Each event becomes a flat item with expansion and sourcename
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

  // Combine and flatten all sources
  return flatten(results[0]).concat(flatten(results[1]));
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

  // Sort expansions and sources alphabetically
  return Object.keys(grouped).sort().map(expansion => ({
    expansion,
    sources: Object.keys(grouped[expansion]).sort().map(sourcename => ({
      sourcename,
      items: grouped[expansion][sourcename]
    }))
  }));
}
