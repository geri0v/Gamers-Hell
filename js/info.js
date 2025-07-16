const GW2TREASURES_BEARER = "e53da4d7-cb26-4225-b8fb-dfe4a81ad834";
const EXTRA_CSV_SOURCES = [];

const waypointCache = new Map();
const wikiDescCache = new Map();

async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

async function safeFetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchGW2ItemsBulk(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200).join(",");
    const data = await safeFetchJson(`https://api.guildwars2.com/v2/items?ids=${chunk}`);
    if (data) out.push(...data);
  }
  return out;
}

export async function fetchGW2PricesBulk(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200).join(",");
    const data = await safeFetchJson(`https://api.guildwars2.com/v2/commerce/prices?ids=${chunk}`);
    if (data) out.push(...data);
  }
  return out;
}

export async function fetchGW2TreasuresBulkItems(ids) {
  const res = await fetch("https://api.gw2treasures.com/items/bulk/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GW2TREASURES_BEARER}`
    },
    body: JSON.stringify(ids)
  });
  return res.ok ? await res.json() : [];
}

export async function fetchGW2TreasuresBulkPrices(ids) {
  const res = await fetch("https://api.gw2treasures.com/items/bulk/tp-prices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GW2TREASURES_BEARER}`
    },
    body: JSON.stringify(ids)
  });
  return res.ok ? await res.json() : [];
}

export async function fetchGW2TreasuresContainerContents(ids) {
  const res = await fetch("https://api.gw2treasures.com/items/bulk/container-contents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GW2TREASURES_BEARER}`
    },
    body: JSON.stringify(ids)
  });
  return res.ok ? await res.json() : [];
}

export async function fetchWikiDescription(name) {
  if (!name) return "";
  if (wikiDescCache.has(name)) return wikiDescCache.get(name);

  const url = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&explaintext&format=json&origin=*&titles=${encodeURIComponent(name)}&exsentences=2`;
  const data = await safeFetchJson(url);
  let desc = "";

  if (data?.query?.pages) {
    for (const key in data.query.pages) {
      if (data.query.pages[key].extract) {
        desc = data.query.pages[key].extract.split('. ').slice(0, 2).join('. ') + '.';
        break;
      }
    }
  }

  wikiDescCache.set(name, desc);
  return desc;
}

// ✅ Replaced 429-prone map resolver with one-shot POI dump
export async function resolveWaypoints(chatcodes) {
  const uncached = chatcodes.filter(c => !waypointCache.has(c));
  if (!uncached.length) return Object.fromEntries(waypointCache);

  const allPOIs = await safeFetchJson(`https://api.guildwars2.com/v2/points-of-interest?ids=all`);
  if (!Array.isArray(allPOIs)) return Object.fromEntries(waypointCache);

  for (const poi of allPOIs) {
    if (poi.type === "waypoint" && poi.chat_link && uncached.includes(poi.chat_link)) {
      waypointCache.set(poi.chat_link, {
        name: poi.name,
        wiki: `https://wiki.guildwars2.com/wiki/${encodeURIComponent(poi.name.replace(/ /g, "_"))}`
      });
    }
  }

  return Object.fromEntries(waypointCache);
}

export async function fetchCSVPrices() {
  let prices = {};
  for (const url of EXTRA_CSV_SOURCES) {
    const text = await safeFetchText(url);
    if (!text) continue;
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    const idIdx = headers.indexOf('item_id');
    const priceIdx = headers.indexOf('buy_price');

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const id = parseInt(cols[idIdx]);
      const price = parseInt(cols[priceIdx]);
      if (!isNaN(id) && !isNaN(price)) prices[id] = price;
    }
  }
  return prices;
}

export function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return `${g}g ${s}s ${c}c`;
}

export async function enrichItemsAndPrices(itemIds) {
  const items = await fetchGW2ItemsBulk(itemIds) || [];
  const prices = await fetchGW2PricesBulk(itemIds) || [];

  const fallbackItems = items.length ? items : await fetchGW2TreasuresBulkItems(itemIds) || [];
  const fallbackPrices = prices.length ? prices : await fetchGW2TreasuresBulkPrices(itemIds) || [];
  const csvPrices = await fetchCSVPrices();

  const priceMap = new Map();
  [...fallbackPrices, ...prices].forEach(p => {
    const price = p.sells?.unit_price || p.buy?.unit_price;
    if (p.id != null) priceMap.set(p.id, price);
  });

  for (const [id, p] of Object.entries(csvPrices)) {
    if (!priceMap.has(Number(id))) priceMap.set(Number(id), p);
  }

  return (fallbackItems || items).map(item => ({
    ...item,
    price: priceMap.get(item.id) ?? null
  }));
}

export async function enrichContainerContents(containerIds) {
  const contents = await fetchGW2TreasuresContainerContents(containerIds);
  return contents || [];
}
