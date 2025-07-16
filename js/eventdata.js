// eventdata.js
import { getTpUrl } from './tp.js';
import { fetchWaypoints } from './waypoint.js';  // Your waypoint fetching module

// URLs and constants (update as needed)
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQI6XWf68WL1QBPkqgaNoFvNS4yV47h1OZ_E8MEZQiVBSMYVKNpeMWR49rJgNDJATkswIZiqktmrcxx/pub?output=csv';
const OTC_CSV_URL = 'https://your-csv-host/otc_itemlist.csv';  // Replace with your OTC CSV URL
const GW2TREASURES_API = 'https://api.gw2treasures.com/item/prices?ids=';

const GW2_API = {
  MAPS: 'https://api.guildwars2.com/v2/maps',
  EVENTS: 'https://api.guildwars2.com/v1/event_details.json',
};

// Regex patterns for filtering generic container/junk items
const FILTER_CONTAINERS = [
  /chest/i, /bag/i, /box/i, /bundle/i, /cache/i,
  /pouch/i, /sack/i, /^container$/i, /^trophy$/i, /^reward$/i,
];

// Helper: checks if loot item is generic container/junk
function isJunkOrContainer(name) {
  if (!name) return false;
  return FILTER_CONTAINERS.some(rx => rx.test(name));
}

// Helper: Robust fetch with retries
async function fetchWithRetry(url, options = {}, retries = 3, delay = 500) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
    return response;
  } catch (e) {
    if (retries <= 0) throw e;
    await new Promise(res => setTimeout(res, delay));
    return fetchWithRetry(url, options, retries - 1, delay * 2);
  }
}

// Fetch all maps from GW2 API (batch requests)
async function fetchAllApiMaps() {
  const ids = await fetchWithRetry(GW2_API.MAPS).then(r => r.json());
  const allMaps = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).join(',');
    const chunkMaps = await fetchWithRetry(`${GW2_API.MAPS}?ids=${chunk}`).then(r => r.json());
    allMaps.push(...chunkMaps);
  }
  return allMaps;
}

// Fetch all events from GW2 API
async function fetchAllApiEvents() {
  const res = await fetchWithRetry(GW2_API.EVENTS);
  const data = await res.json();
  return Object.values(data.events);
}

// Fetch published loot data CSV from Google Sheets, parse with PapaParse
async function fetchLootDataFromCsv() {
  const res = await fetchWithRetry(GOOGLE_SHEET_CSV_URL);
  const csvText = await res.text();
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err),
    });
  });
}

// Fetch OTC CSV used for item ID and price mapping
async function fetchOtcCsv() {
  try {
    const res = await fetchWithRetry(OTC_CSV_URL);
    const text = await res.text();
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: results => resolve(results.data),
        error: err => reject(err),
      });
    });
  } catch {
    return [];
  }
}

// Fetch prices from Gw2Treasures by batched item ID list
async function fetchGw2TreasuresPrices(itemIds = []) {
  if (!itemIds.length) return {};
  let prices = {};
  const batchSize = 50;
  for (let i = 0; i < itemIds.length; i += batchSize) {
    const chunk = itemIds.slice(i, i + batchSize).join(',');
    try {
      const res = await fetchWithRetry(`${GW2TREASURES_API}${chunk}`);
      if (res.ok) {
        const json = await res.json();
        prices = { ...prices, ...json };
      }
    } catch {
      // Ignore fetch failures per batch
    }
  }
  return prices;
}

// Organizes Sheet CSV rows into loot index keyed by source (event/chest/etc)
function buildLootIndex(sheetRows) {
  const lootIndex = {};
  for (const row of sheetRows) {
    const source = row['Event/Chest'] || '';
    if (!lootIndex[source]) lootIndex[source] = [];
    lootIndex[source].push({
      mapName: row.MapName,
      waypoint: row.Waypoint,
      sourceType: row.SourceType || source,
      item: row.Item,
      rarity: row.Rarity,
      guaranteed: row.Guaranteed === 'Yes',
      collectible: row.Collectible === 'Yes',
      bound: row.Bound === 'Yes',
      achievementLinked: row.AchievementLinked === 'Yes',
      tpLink: row.TPLink,
      wikiLink: row.WikiLink,
      timestamp: row.Timestamp,
    });
  }
  return lootIndex;
}

// Filters loot to include unique, rare, guaranteed,
// collectibles, minis, achievements; excludes generic champ bags unless only loot
function filterLootItems(items) {
  if (!items || items.length === 0) return [];
  const onlyGenericChampBags = items.every(i => /^Champion .* Bag$/i.test(i.item));
  if (onlyGenericChampBags) return items;

  return items.filter(i => {
    if (/^Champion .* Bag$/i.test(i.item)) return false;
    if (i.guaranteed) return true;
    if (!i.rarity) return false;
    const rarity = i.rarity.toLowerCase();
    const collectiblesKeywords = ['mini', 'collection', 'collectible', 'skin'];
    if (rarity.includes('legendary') ||
        rarity.includes('ascended') ||
        rarity.includes('unique') ||
        rarity.includes('rare') ||
        collectiblesKeywords.some(kw => i.item.toLowerCase().includes(kw))) return true;
    return false;
  });
}

// Calculate Euclidean distance for waypoint proximity
function calculateDistance(a, b) {
  if (!a || !b) return Infinity;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Main function: fetches all data, deeply merges, enriches, applies flags & filtering
export async function generateDeepEventDataset() {
  const [apiMaps, apiEvents, waypoints, sheetRows, otcRows] = await Promise.all([
    fetchAllApiMaps(),
    fetchAllApiEvents(),
    fetchWaypoints(),
    fetchLootDataFromCsv(),
    fetchOtcCsv(),
  ]);

  // Build loot index from sheet
  const lootIndex = buildLootIndex(sheetRows);

  // Build OTC item name → ID map for price lookup
  const otcNameToId = {};
  otcRows.forEach(({ Name, ID }) => {
    if (Name && ID) otcNameToId[Name] = ID;
  });

  // Collect all loot items names to fetch prices
  const allLootItemNames = new Set();
  Object.values(lootIndex).forEach(arr => arr.forEach(i => {
    if (i.item && !isJunkOrContainer(i.item)) allLootItemNames.add(i.item);
  }));
  const uniqueItemIds = [...allLootItemNames].map(name => otcNameToId[name]).filter(Boolean);

  const pricesMap = await fetchGw2TreasuresPrices(uniqueItemIds);

  // Map api maps for easy ID lookup
  const mapById = new Map(apiMaps.map(m => [m.id, m]));

  // Compose final dataset grouped by map
  const eventsByMap = {};

  for (const event of apiEvents) {
    const map = mapById.get(event.map_id);
    if (!map) continue;

    // Filter loot items with your itemfilter
    const filteredLoot = filterLootItems(lootIndex[event.name] || []);

    // Enrich loot items with prices, TP & wiki links, achievements/collectibles flags, icons can be added in UI
    const enrichedLoot = filteredLoot.map(item => {
      const otcId = otcNameToId[item.item];
      const priceData = otcId && pricesMap[otcId] ? pricesMap[otcId] : {};
      return {
        ...item,
        tp: item.tpLink || (otcId ? getTpUrl(otcId) : ''),
        price: priceData.price || null,
        price_usd: priceData.price_usd || null,
        flags: {
          legendary: /legendary/i.test(item.rarity),
          ascended: /ascended/i.test(item.rarity),
          unique: /unique/i.test(item.rarity),
          rare: /rare/i.test(item.rarity),
          collectible: item.collectible,
          guaranteed: item.guaranteed,
          miniature: /mini/i.test(item.item),
          achievementLinked: item.achievementLinked,
        }
      };
    });

    // Find closest waypoint to event coordinates (if available)
    let eventWaypoint = '';
    if (event.coord && waypoints && waypoints.length) {
      let closest = null;
      let minDist = Infinity;
      for (const wp of waypoints) {
        if (wp.type !== 'Waypoint' || wp.map_id !== event.map_id) continue;
        const dist = calculateDistance(event.coord, wp.coord);
        if (dist < minDist) {
          minDist = dist;
          closest = wp;
        }
      }
      if (closest) eventWaypoint = closest.name;
    }

    // Compose enriched event object
    const enrichedEvent = {
      id: event.id,
      name: event.name,
      map: map.name,
      region: map.region_name || 'Unknown',
      expansion: map.continent_name || 'Core',
      level: event.level || null,
      waypoint: eventWaypoint,
      loot: enrichedLoot,
    };

    if (!eventsByMap[map.name]) eventsByMap[map.name] = [];
    eventsByMap[map.name].push(enrichedEvent);
  }

  return {
    maps: apiMaps,
    events: apiEvents,
    waypoints,
    lootIndex,
    otcItems: otcRows,
    pricesMap,
    eventsByMap,
  };
}
