// data.js
export async function fetchAllData() {
  const urls = [
    'https://geri0v.github.io/Gamers-Hell/json/core/temples.json',
    'https://geri0v.github.io/Gamers-Hell/json/core/untimedcore.json'
  ];
  // Fetch both JSONs in parallel
  const [temples, untimedcore] = await Promise.all(
    urls.map(url => fetch(url).then(res => res.json()))
  );
  // Combine and return
  return [...temples, ...untimedcore];
}

// Utility to group and sort by expansion, then by sourcename
export function groupAndSort(data) {
  // Group by 'expansion'
  const grouped = {};
  data.forEach(item => {
    const expansion = item.expansion || 'Unknown Expansion';
    const source = item.sourcename || 'Unknown Source';
    if (!grouped[expansion]) grouped[expansion] = {};
    if (!grouped[expansion][source]) grouped[expansion][source] = [];
    grouped[expansion][source].push(item);
  });

  // Sort expansions and sources alphabetically
  const sortedExpansions = Object.keys(grouped).sort();
  const result = sortedExpansions.map(exp => {
    const sources = grouped[exp];
    const sortedSources = Object.keys(sources).sort();
    return {
      expansion: exp,
      sources: sortedSources.map(src => ({
        sourcename: src,
        items: sources[src]
      }))
    };
  });
  return result;
}
