import { getTpUrl } from './tp.js'; // re-use your Trading Post URL builder

const GW2_API = {
  EVENTS: 'https://api.guildwars2.com/v1/event_details.json',
  MAPS: 'https://api.guildwars2.com/v2/maps'
};

// Your Google Sheets backend web app URL (serves LootData sheet JSON)
const GOOGLE_SHEET_SCRIPT = 'https://script.google.com/macros/s/AKfycbxU0jDf9q-stm0niABqB7o0eFp_hyRcVdlduYT1dWHRPio0NF4raVulsT6Dw4DODXsx/exec';

// Container-ish loot names (to filter out containers)
const FILTER_CONTAINERS = [
  /chest/i, /bag/i, /box/i, /bundle/i, /cache/i, /pouch/i, /sack/i, /^container$/i, /^trophy$/i, /^reward$/i
];

function isJunkOrContainer(name) {
  return FILTER_CONTAINERS.some(rx => rx.test(name));
}

// --- GW2 API calls -- maps data
async function fetchAllMaps() {
  const ids = await fetch(GW2_API.MAPS).then(res => res.json());
  const allMaps = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).join(',');
    const chunkMaps = await fetch(`${GW2_API.MAPS}?ids=${chunk}`).then(res => res.json());
    allMaps.push(...chunkMaps);
  }
  return allMaps.filter(m => m.type === "Public");
}

// --- GW2 API calls -- events data
async function fetchAllEvents() {
  const res = await fetch(GW2_API.EVENTS);
  const raw = await res.json();
  return Object.values(raw.events);
}

// --- Fetch deep loot from your Sheets backend, fully enriched
async function fetchSheetLootIndex() {
  const url = GOOGLE_SHEET_SCRIPT + '?format=json';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch loot from Sheet backend');
  const rows = await res.json();

  const lootIndex = {};
  for (const row of rows) {
    if (!lootIndex[row.SourceName]) lootIndex[row.SourceName] = [];
    if (isJunkOrContainer(row.LootItem)) continue; // skip container labels
    lootIndex[row.SourceName].push({
      name: row.LootItem,
      rarity: row.Rarity,
      guaranteed: row.Guaranteed === 'Yes',
      accountBound: row.AccountBound === 'Yes',
      collectible: row.Collectible === 'Yes',
      achievementLinked: row.AchievementLinked === 'Yes',
      tp: row.TPLink,
      wikiUrl: row.WikiLink
    });
  }
  return lootIndex;
}

// --- Optional: Fetch CSV or gw2treasures data here, parse & return as needed
// Implement similar as fetchAllMaps or fetchSheetLootIndex depending on source
// For example:
/*
async function fetchGw2TreasuresData() {
  const url = 'https://cdn.gw2treasures.com/data/somefile.csv';
  const res = await fetch(url);
  const csvText = await res.text();
  // parse and return... (you can use libraries or own parser)
}
*/

// --- Compose the full enriched event dataset for frontend use
export async function generateDeepEventDataset() {
  const [maps, events, sheetLoot /*, treasuresData, csvData */] = await Promise.all([
    fetchAllMaps(),
    fetchAllEvents(),
    fetchSheetLootIndex(),
    // fetchGw2TreasuresData(),
    // fetchSomeCsvData()
  ]);

  const mapById = new Map(maps.map(m => [m.id, m]));
  // Optional: enrich maps/events with your treasuresData or csvData here

  // Group enriched events by map with loot attached from Sheet backend
  const eventsByMap = {};
  for (const event of events) {
    const map = mapById.get(event.map_id);
    if (!map) continue;

    const loot = sheetLoot[event.name] || [];

    const enriched = {
      id: event.id,
      name: event.name,
      map: map.name,
      region: map.region_name || 'Unknown',
      expansion: map.continent_name || 'Core',
      level: event.level || null,
      waypoint: '', // Could extend with waypoint info in future
      loot
    };

    if (!eventsByMap[map.name]) eventsByMap[map.name] = [];
    eventsByMap[map.name].push(enriched);
  }

  // Optionally merge or enrich with treasuresData or CSV info here

  return eventsByMap; // fully enriched event dataset ready for UI
}

// --- Optional: post updates to Sheets backend, you keep this
async function postLoot(eventName, loot) {
  const body = new URLSearchParams({
    EventName: eventName,
    LootItem: loot.LootItem,
    Rarity: loot.Rarity || '',
    Guaranteed: loot.Guaranteed ? 'Yes' : '',
    AccountBound: loot.AccountBound ? 'Yes' : '',
    Collectible: loot.Collectible ? 'Yes' : '',
    AchievementLinked: loot.AchievementLinked ? 'Yes' : '',
    Tp: loot.Tp || '',
    WikiUrl: loot.WikiUrl || '',
    Timestamp: new Date().toISOString()
  });

  return fetch(GOOGLE_SHEET_SCRIPT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
}
