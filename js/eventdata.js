import { getTpUrl } from './tp.js';

const GW2_API = {
  MAPS: 'https://api.guildwars2.com/v2/maps',
  EVENTS: 'https://api.guildwars2.com/v1/event_details.json',
};

const GOOGLE_SHEET_SCRIPT = 'https://script.google.com/macros/s/AKfycbxU0jDf9q-stm0niABqB7o0eFp_hyRcVdlduYT1dWHRPio0NF4raVulsT6Dw4DODXsx/exec';

const GW2TREASURES_API = 'https://api.gw2treasures.com/item/prices?ids='; // Example endpoint

const FILTER_CONTAINERS = [
  /chest/i, /bag/i, /box/i, /bundle/i, /cache/i,
  /pouch/i, /sack/i, /^container$/i, /^trophy$/i, /^reward$/i,
];

// === Utility Functions ===

function isJunkOrContainer(name) {
  return FILTER_CONTAINERS.some(rx => rx.test(name));
}

function normalizeWikiName(name) {
  return name.trim().replace(/\s+/g, '_');
}

// === API Fetchers ===

async function fetchAllApiMaps() {
  const ids = await fetch(GW2_API.MAPS).then(r => r.json());
  const all = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).join(',');
    const maps = await fetch(`${GW2_API.MAPS}?ids=${chunk}`).then(r => r.json());
    all.push(...maps);
  }
  return all.filter(m => m.type === 'Public');
}

async function fetchAllApiEvents() {
  const res = await fetch(GW2_API.EVENTS);
  const data = await res.json();
  return Object.values(data.events);
}

// Fetch enriched loot data from Sheet backend (primary deep loot source)
async function fetchSheetLootIndex() {
  const res = await fetch(`${GOOGLE_SHEET_SCRIPT}?format=json`);
  if (!res.ok) throw new Error('Failed to fetch loot from Sheet backend');
  const rows = await res.json();

  const lootIndex = {};
  for (const row of rows) {
    if (!lootIndex[row.SourceName]) lootIndex[row.SourceName] = [];
    if (isJunkOrContainer(row.LootItem)) continue; // Filter junk containers here
    lootIndex[row.SourceName].push({
      name: row.LootItem,
      rarity: row.Rarity,
      guaranteed: row.Guaranteed === 'Yes',
      accountBound: row.AccountBound === 'Yes',
      collectible: row.Collectible === 'Yes',
      achievementLinked: row.AchievementLinked === 'Yes',
      tp: row.TPLink,
      wikiUrl: row.WikiLink,
    });
  }
  return lootIndex;
}

// Fetch Gw2Treasures prices for given item IDs (mapping needs to be managed externally)
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
    } catch (e) {
      // Ignore failed batches
    }
  }
  return prices;
}

// Post a loot record back to Google Sheets backend
async function postLoot(eventName, loot) {
  const body = new URLSearchParams({
    EventName: eventName,
    LootItem: loot.name,
    Rarity: loot.rarity || '',
    Guaranteed: loot.guaranteed ? 'Yes' : '',
    AccountBound: loot.accountBound ? 'Yes' : '',
    Collectible: loot.collectible ? 'Yes' : '',
    AchievementLinked: loot.achievementLinked ? 'Yes' : '',
    Tp: loot.tp || '',
    WikiUrl: loot.wikiUrl || '',
    Timestamp: new Date().toISOString(),
  });

  return fetch(GOOGLE_SHEET_SCRIPT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

// === Merge Helpers ===

/**
 * Merge two arrays keyed by 'id', prioritizing sheetData entries.
 */
function mergeById(sheetData, apiData) {
  const map = new Map();
  apiData.forEach(item => map.set(item.id, item));
  sheetData.forEach(item => map.set(item.id, item)); // Sheet data overrides
  return Array.from(map.values());
}

// === Main Function ===

/**
 * Fetch all possible data from every source, merge, enrich, and prepare dataset keyed by map.
 */
export async function generateDeepEventDataset() {
  // 1. Fetch all data concurrently
  const [apiMaps, apiEvents, sheetLoot] = await Promise.all([
    fetchAllApiMaps(),
    fetchAllApiEvents(),
    fetchSheetLootIndex(),
  ]);

  // 2. Merge maps and events if you have sheet stored maps/events (implement if applicable)
  // For now, we assume API maps/events are canonical. Extend this as needed.

  // 3. Create quick id-based map lookup
  const mapById = new Map(apiMaps.map(m => [m.id, m]));

  // 4. Build events grouped by map with loot enriched from Sheet loot index
  const eventsByMap = {};
  for (const event of apiEvents) {
    const map = mapById.get(event.map_id);
    if (!map) continue;

    const loot = sheetLoot[event.name] || [];

    const enrichedEvent = {
      id: event.id,
      name: event.name,
      map: map.name,
      region: map.region_name || 'Unknown',
      expansion: map.continent_name || 'Core',
      level: event.level || null,
      waypoint: '', // extend with waypoints if available later
      loot,
    };

    if (!eventsByMap[map.name]) eventsByMap[map.name] = [];
    eventsByMap[map.name].push(enrichedEvent);
  }

  // 5. Optionally enrich loot with prices or other data here (fetchGw2TreasuresPrices)

  return eventsByMap;
}
