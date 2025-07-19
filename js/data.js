// js/data.js

const MANIFEST_URL = 'https://geri0v.github.io/Gamers-Hell/json/manifest.json';
const GOOGLE_SHEET_MAIN_LOOT_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQI6XWf68WL1QBPkqgaNoFvNS4yV47h1OZ_E8MEZQiVBSMYVKNpeMWR49rJgNDJATkswIZiqktmrcxx/pub?gid=1436649532&single=true&output=csv';

/**
 * Fetches and merges all events from manifest + sheet, returns flat array.
 */
export async function fetchAllData(onProgress = null) {
  let allEvents = [];
  let sheetRows = [];

  // 1. Haal de manifest op en laad álle event-bestanden!
  try {
    const manifestRes = await fetch(MANIFEST_URL);
    if (!manifestRes.ok) throw new Error('manifest.json niet beschikbaar');
    const manifest = await manifestRes.json();
    if (!Array.isArray(manifest.files)) throw new Error('manifest.json heeft geen files-lijst');

    const jsonPromises = manifest.files.map(async file => {
      const url = file.startsWith('http') ? file : MANIFEST_URL.replace('manifest.json', file);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Event JSON niet gevonden: ${url}`);
      return r.json();
    });

    const jsonFiles = await Promise.all(jsonPromises);
    // Flatten and normalize keys to always {name, map, expansion, code, loot...}
    allEvents = jsonFiles.flat()
      .map(ev => ({
        ...ev,
        loot: (ev.loot || []).map(l => ({
          name: l.name || l.Item || '',
          id: l.id || l.ItemID ? Number(l.ItemID) : undefined,
          rarity: l.rarity || l.Rarity || '',
          guaranteed: l.guaranteed ?? l.Guaranteed === 'Yes'
        }))
      }));
    if (onProgress) onProgress(allEvents, MANIFEST_URL, null);
    console.log(`[DATA] Loaded ${allEvents.length} events from manifest files`);
  } catch (err) {
    console.error('[DATA] master manifest load error:', err);
    if (onProgress) onProgress([], MANIFEST_URL, err);
  }

  // 2. Sheet data ophalen en normaliseren
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
    // Normaliseer sheetRows (naam, map, id, rarity, guaranteed)
    sheetRows = sheetRows.filter(r => r.EventName && r.MapName && r.Item)
      .map(r => ({
        EventName: r.EventName,
        MapName: r.MapName,
        Expansion: r.Expansion,
        loot: [{
          name: r.Item,
          id: r.ItemID ? Number(r.ItemID) : undefined,
          rarity: r.Rarity,
          guaranteed: r.Guaranteed === 'Yes',
        }]
      }));
    if (onProgress) onProgress(sheetRows, GOOGLE_SHEET_MAIN_LOOT_CSV_URL, null);
    console.log(`[DATA] Loaded ${sheetRows.length} rows from Sheet`);
  } catch (err) {
    console.error('[DATA] main_loot Sheet load error:', err);
    if (onProgress) onProgress([], GOOGLE_SHEET_MAIN_LOOT_CSV_URL, err);
  }

  // 3. Merge: alles op uniform key: name+map
  if (allEvents.length && sheetRows.length) {
    const eventsByKey = {};
    allEvents.forEach(e => {
      const key = `${(e.name||'').trim().toLowerCase()}|${(e.map||'').trim().toLowerCase()}`;
      eventsByKey[key] = { ...e, loot: [...(e.loot||[])] };
    });
    sheetRows.forEach(row => {
      const k = `${(row.EventName||'').trim().toLowerCase()}|${(row.MapName||'').trim().toLowerCase()}`;
      if (eventsByKey[k]) {
        const eventLoot = eventsByKey[k].loot || [];
        // Voeg alleen toe als naam nog niet bestaat
        row.loot.forEach(lootItem => {
          if (!eventLoot.some(l => l.name === lootItem.name && l.rarity === lootItem.rarity)) {
            eventLoot.push(lootItem);
          }
        });
        eventsByKey[k].loot = eventLoot;
      } else {
        // Sheet-only event
        eventsByKey[k] = {
          name: row.EventName,
          map: row.MapName,
          expansion: row.Expansion,
          loot: [...row.loot]
        };
      }
    });
    return Object.values(eventsByKey);
  }
  if (allEvents.length) return allEvents;
  if (sheetRows.length) {
    return sheetRows.map(r=>({
      name: r.EventName,
      map: r.MapName,
      expansion: r.Expansion,
      loot: [...r.loot]
    }));
  }
  throw new Error('Geen eventdata geladen uit JSON of Sheet!');
}
