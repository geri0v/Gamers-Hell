// == Gamers-Hell: iteminfo.js ==

const OTC_CSV_URL = 'https://raw.githubusercontent.com/otc-cirdan/gw2-items/master/items.csv';
let otcCsvCache = null;

window.loadOtcCsv = async function() {
  if (otcCsvCache) return otcCsvCache;
  otcCsvCache = {};
  try {
    const res = await fetch(OTC_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      if (row.length !== headers.length) continue;
      const obj = {};
      headers.forEach((h, idx) => obj[h.trim()] = row[idx]?.trim());
      if (obj.id) otcCsvCache[obj.id] = obj;
      if (obj.name) otcCsvCache[obj.name.toLowerCase()] = obj;
      if (obj.chatcode) otcCsvCache[obj.chatcode] = obj;
    }
  } catch (e) {
    console.error('Failed to load OTC CSV', e);
  }
  return otcCsvCache;
};

window.getItemFullInfo = async function(query) {
  async function fetchFromApiById(itemId) {
    try {
      const resp = await fetch(`https://api.guildwars2.com/v2/items/${itemId}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return {
        id: data.id,
        name: data.name,
        chatcode: data.chat_link,
        icon: data.icon,
        description: data.description,
        rarity: data.rarity,
        type: data.type,
        vendor_value: data.vendor_value,
        flags: data.flags,
        wiki: `https://wiki.guildwars2.com/wiki/${encodeURIComponent(data.name.replace(/ /g, '_'))}`,
        accountbound: data.flags?.includes('AccountBound') || data.flags?.includes('AccountBoundOnUse')
      };
    } catch (e) {
      console.error('Failed to fetch from API by ID', e);
      return null;
    }
  }
  async function fetchTpValueById(itemId) {
    try {
      const resp = await fetch(`https://api.guildwars2.com/v2/commerce/prices/${itemId}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.sells && typeof data.sells.unit_price === 'number' ? data.sells.unit_price : null;
    } catch (e) {
      console.error('Failed to fetch TP value', e);
      return null;
    }
  }
  async function fetchFromWikiByName(name) {
    if (!name) return null;
    try {
      const url = `https://wiki.guildwars2.com/api.php?action=query&format=json&origin=*&prop=pageprops|info&titles=${encodeURIComponent(name)}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data.query || !data.query.pages) return null;
      const page = Object.values(data.query.pages)[0];
      if (!page || page.missing) return null;
      return {
        name: page.title,
        wiki: `https://wiki.guildwars2.com/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
      };
    } catch (e) {
      console.error('Failed to fetch from Wiki by name', e);
      return null;
    }
  }
  async function fetchFromBltcById(itemId) {
    try {
      const resp = await fetch(`https://api.gw2bltc.com/price/${itemId}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data || !data.sell) return null;
      return { tp_value: data.sell };
    } catch (e) {
      console.error('Failed to fetch from BLTC by ID', e);
      return null;
    }
  }
  async function fetchFromOtcCsv(query) {
    const cache = await window.loadOtcCsv();
    if (!cache) return null;
    if (typeof query === 'number' || /^\d+$/.test(query)) {
      if (cache[query]) return cache[query];
    }
    if (typeof query === 'string') {
      if (cache[query]) return cache[query];
      if (cache[query.toLowerCase()]) return cache[query.toLowerCase()];
    }
    return null;
  }

  let info = null;
  let itemId = null;
  if (typeof query === 'number' || /^\d+$/.test(query)) {
    itemId = Number(query);
    info = await fetchFromApiById(itemId);
  }
  if (!info && typeof query === 'string' && query.startsWith('[&')) {
    const otc = await fetchFromOtcCsv(query);
    if (otc && otc.id) {
      itemId = otc.id;
      info = await fetchFromApiById(itemId);
      if (info) info.chatcode = otc.chatcode;
    }
  }
  if (!info && typeof query === 'string') {
    const otc = await fetchFromOtcCsv(query);
    if (otc && otc.id) {
      itemId = otc.id;
      info = await fetchFromApiById(itemId);
      if (info) info.chatcode = otc.chatcode;
    }
  }
  if (!info && typeof query === 'string') {
    info = await fetchFromWikiByName(query);
  }
  if (!info) {
    const otc = await fetchFromOtcCsv(query);
    if (otc) {
      info = {
        id: otc.id,
        name: otc.name,
        chatcode: otc.chatcode,
        icon: otc.icon,
        vendor_value: otc.vendor_value ? parseInt(otc.vendor_value) : undefined,
        wiki: otc.name ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(otc.name.replace(/ /g, '_'))}` : undefined,
        accountbound: otc.bound === 'AccountBound'
      };
    }
  }
  if (!info) info = { name: query, wiki: undefined };
  if (!itemId && info.id) itemId = info.id;
  info.id = itemId || info.id;

  let tp_value = null, vendor_value = null;
  if (itemId) {
    tp_value = await fetchTpValueById(itemId);
    if (tp_value == null) {
      const bltc = await fetchFromBltcById(itemId);
      if (bltc && bltc.tp_value) tp_value = bltc.tp_value;
    }
  }
  if (typeof info.vendor_value === 'number') vendor_value = info.vendor_value;
  else if (info.vendor_value) vendor_value = parseInt(info.vendor_value);
  else if (!vendor_value && itemId) {
    const otc = await fetchFromOtcCsv(itemId);
    if (otc && otc.vendor_value) vendor_value = parseInt(otc.vendor_value);
  }
  info.tp_value = tp_value;
  info.vendor_value = vendor_value;
  return info;
};
