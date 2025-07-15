const MANIFEST_URL = 'https://geri0v.github.io/Gamers-Hell/json/manifest.json';

// Include extra CSV-based price/item sources (public)
const EXTRA_CSV_SOURCES = [
  'http://api.gw2tp.com/1/bulk/items.csv'
];

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
        throw e;
      }
    }));

    results.forEach((result, idx) => {
      const url = batch[idx];
      if (result.status === 'fulfilled') {
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

// Extended event filter supporting loot name, type, vendor value, etc.
export function filterEventsExtended(events, { searchTerm, expansion, rarity, lootName, itemType, vendorValueMin, vendorValueMax, chatcode, guaranteedOnly, chanceOnly, sortKey }) {
  let filtered = events;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(e =>
      (e.name && e.name.toLowerCase().includes(term)) ||
      (e.map && e.map.toLowerCase().includes(term))
    );
  }
  if (expansion) {
    filtered = filtered.filter(e => e.expansion === expansion);
  }
  if (rarity) {
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => l.rarity === rarity)
    );
  }
  if (lootName) {
    const ln = lootName.toLowerCase();
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => l.name && l.name.toLowerCase().includes(ln))
    );
  }
  if (itemType) {
    const it = itemType.toLowerCase();
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => l.type && l.type.toLowerCase() === it)
    );
  }
  if (vendorValueMin !== undefined) {
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => l.vendorValue !== undefined && l.vendorValue >= vendorValueMin)
    );
  }
  if (vendorValueMax !== undefined) {
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => l.vendorValue !== undefined && l.vendorValue <= vendorValueMax)
    );
  }
  if (chatcode) {
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => l.chatCode && l.chatCode.toLowerCase() === chatcode.toLowerCase())
    );
  }
  if (guaranteedOnly) {
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => l.guaranteed)
    );
  }
  if (chanceOnly) {
    filtered = filtered.filter(e =>
      (e.loot || []).some(l => !l.guaranteed)
    );
  }
  if (sortKey) {
    filtered = filtered.slice().sort((a, b) => {
      const aVal = (a[sortKey] || '').toLowerCase();
      const bVal = (b[sortKey] || '').toLowerCase();
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
  }
  return filtered;
}
