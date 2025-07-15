// Only working CSV sources (remove all broken ones and keep only https URLs or those you have checked)
const EXTRA_CSV_SOURCES = [
  // Optionally add more CSV URLs here that are HTTPS and working
  // e.g., 'https://yourdomain.github.io/yourrepo/items.csv'
];

// Manifest-driven data loading
const MANIFEST_URL = 'https://geri0v.github.io/Gamers-Hell/json/manifest.json';

export async function fetchAllData(onProgress, batchSize = 5) {
  const manifest = await fetch(MANIFEST_URL).then(r => r.json());
  const JSON_URLS = manifest.files.map(f =>
    f.startsWith('http') ? f : `https://geri0v.github.io/Gamers-Hell/json/${f}`
  );
  const allUrls = JSON_URLS.concat(EXTRA_CSV_SOURCES);

  let allData = [];
  for (let i = 0; i < allUrls.length; i += batchSize) {
    const batch = allUrls.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(async url => {
      try {
        if (url.endsWith('.csv')) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const text = await res.text();
          return parseCSVToJSON(text);
        } else {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return await res.json();
        }
      } catch (e) {
        return []; // Fail gracefully: treat as empty data
      }
    }));

    results.forEach((result, idx) => {
      const url = batch[idx];
      if (result.status === 'fulfilled') {
        const flat = flatten(result.value);
        allData = allData.concat(flat);
        if (onProgress) onProgress(flat, url, null);
      } else {
        // Continue on error, never halt loading
        if (onProgress) onProgress([], url, (result.reason ? result.reason : "Unknown error"));
      }
    });
  }
  return allData;
}

function parseCSVToJSON(csvText) {
  const lines = csvText.split('\n');
  const header = lines[0].split(',');
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split(',');
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j].trim()] = cols[j] ? cols[j].trim() : '';
    }
    data.push(obj);
  }
  return data;
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
