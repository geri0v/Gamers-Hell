const EXTRA_CSV_SOURCES = [
  // Example: 'https://yourdomain.com/custom-prices.csv'
];

const MANIFEST_URL = 'https://geri0v.github.io/Gamers-Hell/json/manifest.json';

/**
 * Fetch and process all files listed in manifest.json + extra sources.
 */
export async function fetchAllData(onProgress = null, batchSize = 5) {
  const manifest = await fetch(MANIFEST_URL).then(r => r.json());
  const urls = manifest.files.map(f =>
    f.startsWith('http') ? f : `https://geri0v.github.io/Gamers-Hell/json/${f}`
  ).concat(EXTRA_CSV_SOURCES);

  let allData = [];

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(async url => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return url.endsWith('.csv') ? parseCSVToJSON(text) : JSON.parse(text);
      } catch {
        return [];
      }
    }));

    results.forEach((result, idx) => {
      const resultData = result.status === 'fulfilled' ? result.value : [];
      const flat = flatten(resultData);
      allData = allData.concat(flat);
      if (onProgress) onProgress(flat, urls[idx], result.reason || null);
    });
  }

  return allData;
}

/**
 * Parse CSV as simple array of objects.
 */
function parseCSVToJSON(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = cols[i] ? cols[i].trim() : '';
    });
    return obj;
  });
}

/**
 * Flatten all: expansion → sources → events into event[].
 */
function flatten(dataArr) {
  if (Array.isArray(dataArr) && dataArr[0]?.sourcename) return dataArr;

  const flat = [];
  dataArr.forEach(expansionObj => {
    const expansion = expansionObj.expansion || 'Unknown Expansion';
    (expansionObj.sources || []).forEach(sourceObj => {
      const sourcename = sourceObj.sourceName || sourceObj.sourcename || 'Unknown Source';
      (sourceObj.events || []).forEach(event => {
        flat.push({ expansion, sourcename, ...event });
      });
    });
  });
  return flat;
}

/**
 * Re-group from flat → by expansion and source (for tables/layout).
 */
export function groupAndSort(data) {
  const grouped = {};
  data.forEach(item => {
    const exp = item.expansion || 'Unknown';
    const src = item.sourcename || 'Unknown';
    grouped[exp] = grouped[exp] || {};
    grouped[exp][src] = grouped[exp][src] || [];
    grouped[exp][src].push(item);
  });

  return Object.entries(grouped).sort().map(([expansion, sources]) => ({
    expansion,
    sources: Object.entries(sources).sort().map(([sourcename, items]) => ({
      sourcename,
      items
    }))
  }));
}

/**
 * Extended filter logic (shared between render + search)
 */
export function filterEventsExtended(events, {
  expansion, rarity, lootName, itemType,
  vendorValueMin, vendorValueMax,
  chatcode, guaranteedOnly, chanceOnly, sortKey
}) {
  return events.filter(e => {
    if (expansion && e.expansion !== expansion) return false;
    if (rarity && !(e.loot || []).some(l => l.rarity === rarity)) return false;
    if (lootName) {
      const val = lootName.toLowerCase();
      if (!(e.loot || []).some(l => l.name?.toLowerCase().includes(val))) return false;
    }
    if (itemType) {
      const val = itemType.toLowerCase();
      if (!(e.loot || []).some(l => l.type?.toLowerCase() === val)) return false;
    }
    if (vendorValueMin !== undefined) {
      if (!(e.loot || []).some(l => l.vendorValue >= vendorValueMin)) return false;
    }
    if (vendorValueMax !== undefined) {
      if (!(e.loot || []).some(l => l.vendorValue <= vendorValueMax)) return false;
    }
    if (chatcode) {
      const val = chatcode.toLowerCase();
      if (!(e.loot || []).some(l => l.chatCode?.toLowerCase() === val)) return false;
    }
    if (guaranteedOnly && !(e.loot || []).some(l => l.guaranteed)) return false;
    if (chanceOnly && !(e.loot || []).some(l => !l.guaranteed)) return false;
    return true;
  });
}
