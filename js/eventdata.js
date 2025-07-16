// eventdata.js
// Dynamic, browser-only GW2 event loot expander → pushes to and loads from Google Sheets backend

import { getTpUrl } from './tp.js';

const GW2_API = {
  EVENTS: 'https://api.guildwars2.com/v1/event_details.json',
  MAPS: 'https://api.guildwars2.com/v2/maps'
};

const GOOGLE_SHEET_SCRIPT = 'https://script.google.com/macros/s/AKfycbxU0jDf9q-stm0niABqB7o0eFp_hyRcVdlduYT1dWHRPio0NF4raVulsT6Dw4DODXsx/exec';

const FILTER_CONTAINERS = [
  /chest/i, /bag/i, /box/i, /bundle/i, /cache/i, /pouch/i, /sack/i, /^container$/i, /^trophy$/i, /^reward$/i
];

function isJunkOrContainer(name) {
  return FILTER_CONTAINERS.some(rx => rx.test(name));
}

function normalizeWikiName(name) {
  return name.trim().replace(/\s+/g, '_');
}

// Deep scan single wiki page for loot table items
async function fetchWikiLoot(eventName) {
  const page = normalizeWikiName(eventName);
  const url = `https://corsproxy.io/?https://wiki.guildwars2.com/wiki/${page}`;

  const res = await fetch(url).then(r => r.text());
  const doc = new DOMParser().parseFromString(res, 'text/html');

  const tables = [...doc.querySelectorAll('table.wikitable')];
  const drops = [];

  for (const table of tables) {
    for (const row of table.querySelectorAll('tr')) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 1) continue;

      const link = cells[0].querySelector('a');
      if (!link) continue;

      const name = link.textContent.trim();
      if (!name || isJunkOrContainer(name)) continue;

      const rarityMatch = cells[1]?.textContent.match(/Ascended|Exotic|Rare|Masterwork|Fine|Basic/i);
      const rarity = rarityMatch ? rarityMatch[0] : '';

      drops.push({
        LootItem: name,
        Rarity: rarity,
        Guaranteed: /guaranteed/i.test(row.textContent),
        AccountBound: /account bound/i.test(row.textContent.toLowerCase()),
        Collectible: /mini|skin|collection|collectible/i.test(name.toLowerCase()),
        AchievementLinked: /achievement|collection|unlock/i.test(row.textContent.toLowerCase()),
        Tp: getTpUrl(name),
        WikiUrl: 'https://wiki.guildwars2.com' + link.getAttribute('href')
      });
    }
  }

  return drops;
}

// Post one record to Google Sheet backend
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

// Load all enriched loot from your Sheet
export async function fetchSheetLootIndex() {
  const sheetViewUrl = GOOGLE_SHEET_SCRIPT + '?format=json';
  const res = await fetch(sheetViewUrl);
  const rows = await res.json();

  const byEvent = {};
  for (const row of rows) {
    if (!byEvent[row.EventName]) byEvent[row.EventName] = [];
    byEvent[row.EventName].push({
      name: row.LootItem,
      rarity: row.Rarity,
      guaranteed: row.Guaranteed === 'Yes',
      accountBound: row.AccountBound === 'Yes',
      collectible: row.Collectible === 'Yes',
      achievementLinked: row.AchievementLinked === 'Yes',
      tp: row.Tp,
      wikiUrl: row.WikiUrl
    });
  }

  return byEvent;
}

// MAIN FUNCTION: Load + enrich + push + attach
export async function generateDeepEventDataset() {
  const maps = await fetchAllMaps();
  const events = await fetchAllEvents();
  const enrichedLoot = await fetchSheetLootIndex();

  const mapById = Object.fromEntries(maps.map(m => [m.id, m]));
  const eventsByMap = {};

  for (const event of events) {
    const map = mapById[event.map_id];
    if (!map) continue;

    const eventLootFromSheet = enrichedLoot[event.name] || [];

    // If not cached via Sheet, pull and push live
    if (eventLootFromSheet.length === 0) {
      try {
        const freshLoot = await fetchWikiLoot(event.name);
        enrichedLoot[event.name] = freshLoot;

        for (const loot of freshLoot) {
          await postLoot(event.name, loot);
        }

        console.log(`Enriched + pushed loot for: ${event.name}`);
      } catch (e) {
        console.warn('Failed to get wiki loot for', event.name, e.message);
      }
    }

    const enrichedEvent = {
      id: event.id,
      name: event.name,
      map: map.name,
      region: map.region_name || 'Unknown',
      expansion: map.continent_name || 'Core',
      level: event.level || null,
      waypoint: '', // Optional future integration
      loot: enrichedLoot[event.name] || []
    };

    if (!eventsByMap[map.name]) eventsByMap[map.name] = [];
    eventsByMap[map.name].push(enrichedEvent);
  }

  return eventsByMap;
}

// Reuse from earlier
async function fetchAllMaps() {
  const ids = await fetch(GW2_API.MAPS).then(res => res.json());
  let all = [];
  for (let i = 0; i < ids.length; i += 100) {
    const idsChunk = ids.slice(i, i + 100).join(',');
    const mapsChunk = await fetch(`${GW2_API.MAPS}?ids=${idsChunk}`).then(r => r.json());
    all.push(...mapsChunk);
  }
  return all.filter(m => m.type === "Public");
}

async function fetchAllEvents() {
  const res = await fetch(GW2_API.EVENTS);
  const data = await res.json();
  return Object.entries(data.events).map(([id, ev]) => ({ id, ...ev }));
}
