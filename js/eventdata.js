import Papa from 'papaparse';
import { getTpUrl } from './tp.js'; // Your Trading Post URL generator

// === Configuration ===
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQI6XWf68WL1QBPkqgaNoFvNS4yV47h1OZ_E8MEZQiVBSMYVKNpeMWR49rJgNDJATkswIZiqktmrcxx/pub?output=csv';
const GOOGLE_SHEET_POST_URL = 'https://script.google.com/macros/s/AKfycbxU0jDf9q-stm0niABqB7o0eFp_hyRcVdlduYT1dWHRPio0NF4raVulsT6Dw4DODXsx/exec';
const GW2_API = {
  MAPS: 'https://api.guildwars2.com/v2/maps',
  EVENTS: 'https://api.guildwars2.com/v1/event_details.json',
  WAYPOINTS: 'https://api.guildwars2.com/v2/points_of_interest',
};
const GW2TREASURES_API = 'https://api.gw2treasures.com/item/prices?ids=';
const OTC_CSV_URL = 'https://your-csv-source/otc_itemlist.csv'; // Replace or add more sources here

const JUNK_FILTER_REGEX = [
  /chest/i, /bag/i, /box/i, /bundle/i, /cache/i,
  /pouch/i, /sack/i, /^container$/i, /^trophy$/i, /^reward$/i,
];

// === Utility ===
function isJunkOrContainer(name) {
  if (!name) return false;
  return JUNK_FILTER_REGEX.some(rx => rx.test(name));
}

// === Fetching Functions ===

// Fetch maps with batching from GW2 API
async function fetchApiMaps() {
  const ids = await fetch(GW2_API.MAPS).then(r => r.json());
  const result = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).join(',');
    const mapsChunk = await fetch(`${GW2_API.MAPS}?ids=${chunk}`).then(r => r.json());
    result.push(...mapsChunk);
  }
  return result;
}

// Fetch events from GW2 API
async function fetchApiEvents() {
  const res = await fetch(GW2_API.EVENTS);
  if (!res.ok) throw new Error('Failed to fetch API events');
  const data = await res.json();
  return Object.values(data.events);
}

// Fetch waypoints and POIs from GW2 API for enrichment
async function fetchApiWaypoints() {
  const res = await fetch(GW2_API.WAYPOINTS);
  if (!res.ok) throw new Error('Failed to fetch waypoints');
  const data = await res.json();
  return data; // Contains POI entries, including waypoints
}

// Fetch full loot and all other mixed data from your Google Sheet CSV (multi-purpose sheet)
async function fetchSheetDataCsv() {
  const res = await fetch(GOOGLE_SHEET_CSV_URL);
  if (!res.ok) throw new Error('Failed to fetch Sheet CSV data');
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

// Fetch optional OTC item list CSV, e.g., with additional properties
async function fetchOtcCsv() {
  try {
    const res = await fetch(OTC_CSV_URL);
    if (!res.ok) return [];
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

// Fetch prices metadata from gw2treasures (placeholder)
async function fetchGw2TreasuresPrices(itemIds = []) {
  if (!itemIds.length) return {};
  const prices = {};
  const batchSize = 50;
  for (let i = 0; i < itemIds.length; i += batchSize) {
    const chunk = itemIds.slice(i, i + batchSize).join(',');
    try {
      const res = await fetch(`${GW2TREASURES_API}${chunk}`);
      if (!res.ok) continue;
      const data = await res.json();
      Object.assign(prices, data);
    } catch {
      // Ignore batch errors silently
    }
  }
  return prices;
}

// === Data Processing ===

// Organize raw sheet rows keyed by SourceName and by MapName for event, chest, or other sources
function organizeSheetData(rows) {
  const lootBySource = {};
  const additionalByMap = {}; // For non-loot rows holding metadata for maps or waypoints

  rows.forEach(row => {
    // Assign loot to source key (Event/Chest)
    if (row['Event/Chest']) {
      const src = row['Event/Chest'];
      if (!lootBySource[src]) lootBySource[src] = [];
      // Don't filter garbage here to preserve ALL data; filtering can be done later by UI
      lootBySource[src].push({
        mapName: row.MapName,
        waypoint: row.Waypoint,
        sourceType: row['Event/Chest'] ? row['Event/Chest'] : '',
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
    } else if (row.MapName) {
      // Possibly map/metadata row (can be extended)
      if (!additionalByMap[row.MapName]) additionalByMap[row.MapName] = [];
      additionalByMap[row.MapName].push(row);
    }
  });

  return { lootBySource, additionalByMap };
}

// Merge maps/events arrays keyed by id, preferring sheet data (or add your merge rules)
function mergeById(sheetData = [], apiData = []) {
  const map = new Map();
  apiData.forEach(d => map.set(d.id, d));
  sheetData.forEach(d => map.set(d.id, d)); // sheet overwrites api duplicates by id
  return Array.from(map.values());
}

// Attach enriched data and merge all sources into a final, comprehensive object keyed by map name
export async function generateCompleteDataset() {
  // Fetch everything concurrently
  const [
    apiMaps,
    apiEvents,
    apiWaypoints,
    sheetRawRows,
    otcItemsRaw,
  ] = await Promise.all([
    fetchAllApiMaps(),
    fetchAllApiEvents(),
    fetchApiWaypoints(),
    fetchSheetDataCsv(),
    fetchOtcCsv()
  ]);

  // Organize sheet loot and metadata
  const { lootBySource, additionalByMap } = organizeSheetData(sheetRawRows);

  // Merge maps if sheet contains map data (or extend to merge metadata)
  // Here assuming no separate map data on sheet, else mergeById(sheetMaps, apiMaps)
  const maps = apiMaps;

  // Merge events similarly if sheet events available, else apiEvents only
  const events = apiEvents;

  // Build lookup map by ID
  const mapById = new Map(maps.map(m => [m.id, m]));

  // Map OTC items by name or id for downstream enrichment
  const otcByName = {};
  otcItemsRaw.forEach(item => {
    if (item.Name) otcByName[item.Name] = item;
  });

  // Collect all unique loot item names
  const lootItemNames = new Set();
  Object.values(lootBySource).forEach(arr => {
    arr.forEach(i => {
      if (i.item && !isJunkOrContainer(i.item)) {
        lootItemNames.add(i.item);
      }
    });
  });

  // Placeholder: Map item names to item IDs for gw2treasures request
  // (requires your own mapping logic, e.g., from OTC or other source)
  const itemNameToId = {}; // Fill this mapping per your data
  const itemIdsToFetch = [...lootItemNames].map(name => itemNameToId[name]).filter(Boolean);

  // Fetch prices from Gw2Treasures
  const pricesById = await fetchGw2TreasuresPrices(itemIdsToFetch);

  // --- Compose the comprehensive dataset keyed by map name --- 
  const eventsByMap = {};

  events.forEach(event => {
    const map = mapById.get(event.map_id);
    if (!map) return;

    const lootForEvent = lootBySource[event.name] || [];

    // Enrich each loot item with trading post links and prices if available
    const enrichedLoot = lootForEvent.map(loot => {
      const itemId = itemNameToId[loot.item];
      const priceInfo = itemId ? pricesById[itemId] : null;
      
      return {
        name: loot.item,
        rarity: loot.rarity,
        guaranteed: loot.guaranteed,
        collectible: loot.collectible,
        bound: loot.bound,
        achievementLinked: loot.achievementLinked,
        tp: loot.tpLink || (itemId ? getTpUrl(itemId) : ''),
        wikiUrl: loot.wikiLink,
        price: priceInfo?.price || null,
        price_usd: priceInfo?.price_usd || null,
        timestamp: loot.timestamp,
        mapName: loot.mapName || map.name,
        waypoint: loot.waypoint || '',
        sourceType: loot.sourceType || ''
      };
    });

    const enrichedEvent = {
      id: event.id,
      name: event.name,
      map: map.name,
      region: map.region_name || 'Unknown',
      expansion: map.continent_name || 'Core',
      level: event.level || null,
      waypoint: '', // Optionally enhance with waypoints lookup later
      loot: enrichedLoot,
      additionalMetadata: additionalByMap[map.name] || []
    };

    if (!eventsByMap[map.name]) eventsByMap[map.name] = [];
    eventsByMap[map.name].push(enrichedEvent);
  });

  return {
    maps,
    events,
    eventsByMap,
    rawLoot: lootBySource,
    rawMetadata: additionalByMap,
    otcItems: otcItemsRaw,
    pricesById,
  };
}

// Export postLoot for external use (posting loot updates to Google Sheets backend)
export {
  postLoot,
};
