const GW2TREASURES_BEARER = "e53da4d7-cb26-4225-b8fb-dfe4a81ad834";
const wikiDescCache = new Map();

async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchWikiDescription(name) {
  if (!name) return "";
  if (wikiDescCache.has(name)) return wikiDescCache.get(name);

  const url = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&explaintext&format=json&origin=*&titles=${encodeURIComponent(name)}&exsentences=2`;
  const data = await safeFetchJson(url);
  let desc = "";
  if (data?.query?.pages) {
    for (const page of Object.values(data.query.pages)) {
      desc = page.extract?.trim() || "";
    }
  }

  wikiDescCache.set(name, desc);
  return desc;
}

export async function fetchGW2ItemsBulk(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const data = await safeFetchJson(`https://api.guildwars2.com/v2/items?ids=${ids.slice(i, i + 200).join(',')}`);
    if (data) out.push(...data);
  }
  return out;
}

export async function fetchGW2PricesBulk(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const data = await safeFetchJson(`https://api.guildwars2.com/v2/commerce/prices?ids=${ids.slice(i, i + 200).join(',')}`);
    if (data) out.push(...data);
  }
  return out;
}

export function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return `${g}g ${s}s ${c}c`;
}

export async function enrichItemsAndPrices(itemIds) {
  const items = await fetchGW2ItemsBulk(itemIds);
  const prices = await fetchGW2PricesBulk(itemIds);
  const priceMap = new Map(prices.map(p => [p.id, p.sells?.unit_price || p.unit_price || 0]));
  return items.map(item => ({ ...item, price: priceMap.get(item.id) || null }));
}
