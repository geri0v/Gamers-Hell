// data.js

const JSON_URLS = [
   'https://geri0v.github.io/Gamers-Hell/json/core/temples.json',
  'https://geri0v.github.io/Gamers-Hell/json/core/untimedcore.json',
  'https://geri0v.github.io/Gamers-Hell/json/core/wb.json'
  // ...your list of JSON URLs
];

// Batch fetch with progress and error handling
export async function fetchAllData(onProgress, batchSize = 5) {
  let allData = [];
  for (let i = 0; i < JSON_URLS.length; i += batchSize) {
    const batch = JSON_URLS.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(url => fetch(url).then(r => r.json())));
    results.forEach((result, idx) => {
      const url = batch[idx];
      if (result.status === "fulfilled") {
        const flat = flatten(result.value);
        allData = allData.concat(flat);
        if (onProgress) onProgress(flat, url, null);
      } else {
        if (onProgress) onProgress([], url, result.reason);
      }
    });
  }
  return allData;
}

function flatten(dataArr) {
  if (Array.isArray(dataArr) && dataArr.length > 0 && dataArr[0].sourcename) return dataArr;
  const flat = [];
  dataArr.forEach(expansionObj => {
    const expansion = expansionObj.expansion || 'Unknown Expansion';
    (expansionObj.sources || []).forEach(sourceObj => {
      const sourcename = sourceObj.sourceName || 'Unknown Source';
      (sourceObj.events || []).forEach(eventObj => {
        flat.push({ expansion, sourcename, ...eventObj });
      });
    });
  });
  return flat;
}

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
