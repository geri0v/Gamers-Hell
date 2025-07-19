// js/data.js

const STATIC_JSON_URL = 'https://geri0v.github.io/Gamers-Hell/json/manifest.json';
const GOOGLE_SHEET_MAIN_LOOT_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQI6XWf68WL1QBPkqgaNoFvNS4yV47h1OZ_E8MEZQiVBSMYVKNpeMWR49rJgNDJATkswIZiqktmrcxx/pub?gid=1436649532&single=true&output=csv';

export async function fetchAllData(onProgress = null) {
  let allEvents = [];
  let sheetRows = [];

  // 1. Static JSON (optioneel)
  try {
    const jsonRes = await fetch(STATIC_JSON_URL);
    if (!jsonRes.ok) throw new Error('events.json niet beschikbaar');
    const jsonData = await jsonRes.json();
    allEvents = Array.isArray(jsonData) ? jsonData : [];
    if (onProgress) onProgress(allEvents, STATIC_JSON_URL, null);
    console.log(`[DATA] Loaded ${allEvents.length} events from JSON`);
  } catch (err) {
    console.error('[DATA] events.json load error:', err);
    if (onProgress) onProgress([], STATIC_JSON_URL, err);
  }

  // 2. Sheet CSV (optioneel)
  try {
    const res = await fetch(GOOGLE_SHEET_MAIN_LOOT_CSV_URL);
    if (!res.ok) throw new Error('Google Sheets main_loot tab niet beschikbaar');
    const csvText = await res.text();
    sheetRows = await new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: results => resolve(results.data),
        error: err => reject(err),
      });
    });
    if (onProgress) onProgress(sheetRows, GOOGLE_SHEET_MAIN_LOOT_CSV_URL, null);
    console.log(`[DATA] Loaded ${sheetRows.length} rows from Sheet`);
  } catch (err) {
    console.error('[DATA] main_loot Sheet load error:', err);
    if (onProgress) onProgress([], GOOGLE_SHEET_MAIN_LOOT_CSV_URL, err);
  }

  // 3. Merge: alle events krijgen loot uit sheetRows toegevoegd op naam+map match (indien beide bestaan)
  if (allEvents.length && sheetRows.length) {
    const eventsByKey = {};
    allEvents.forEach(e => {
      const key = `${(e.name || '').trim().toLowerCase()}|${(e.map || '').trim().toLowerCase()}`;
      eventsByKey[key] = e;
      if (!e.loot) e.loot = [];
    });
    sheetRows.forEach(row => {
      const k = `${(row.EventName || '').trim().toLowerCase()}|${(row.MapName || '').trim().toLowerCase()}`;
      if (eventsByKey[k]) {
        eventsByKey[k].loot = eventsByKey[k].loot || [];
        if (!eventsByKey[k].loot.some(l => l.name === row.Item && l.rarity === row.Rarity)) {
          eventsByKey[k].loot.push({
            name: row.Item,
            id: row.ItemID ? Number(row.ItemID) : undefined,
            rarity: row.Rarity,
            guaranteed: row.Guaranteed === 'Yes',
          });
        }
      }
    });
    return Object.values(eventsByKey);
  }
  if (allEvents.length) return allEvents;
  if (sheetRows.length) {
    return sheetRows.map(row => ({
      name: row.EventName,
      map: row.MapName,
      expansion: row.Expansion,
      loot: [{
        name: row.Item,
        id: row.ItemID ? Number(row.ItemID) : undefined,
        rarity: row.Rarity,
        guaranteed: row.Guaranteed === 'Yes',
      }]
    }));
  }
  throw new Error('Geen eventdata geladen uit JSON of Sheet!');
}
