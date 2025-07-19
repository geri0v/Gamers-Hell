// js/data.js

const STATIC_JSON_URL = 'https://geri0v.github.io/Gamers-Hell/json/manifest.json'; // < Plaats je static JSON met events, structure: Array
const GOOGLE_SHEET_MAIN_LOOT_CSV_URL = 
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQI6XWf68WL1QBPkqgaNoFvNS4yV47h1OZ_E8MEZQiVBSMYVKNpeMWR49rJgNDJATkswIZiqktmrcxx/pub?gid=1436649532&single=true&output=csv';

/**
 * Laadt data van statisch JSON én (optioneel) een Google Sheets CSV.
 * @returns {Promise<Array>} events
 */
export async function fetchAllData(onProgress = null) {
  let allEvents = [];
  let sheetRows = [];

  // 1. Laad statisch JSON (bv. events.json), bijvoorbeeld: [{...event...}, ...]
  try {
    const jsonRes = await fetch(STATIC_JSON_URL);
    if (!jsonRes.ok) throw new Error('Events.json niet beschikbaar');
    const jsonData = await jsonRes.json();
    allEvents = Array.isArray(jsonData) ? jsonData : [];
    if (onProgress) onProgress(allEvents, STATIC_JSON_URL, null);
    console.log(`[DATA] Loaded ${allEvents.length} events from JSON`);
  } catch (err) {
    console.error('[DATA] Events.json load error:', err);
    if (onProgress) onProgress([], STATIC_JSON_URL, err);
    // AllEvents leeg laten maar niet stoppen: sheet kan fallback zijn
  }

  // 2. Laad Google Sheets CSV (optioneel als extra/invulling)
  try {
    const res = await fetch(GOOGLE_SHEET_MAIN_LOOT_CSV_URL);
    if (!res.ok) throw new Error('main_loot sheet foutmelding');
    const csvText = await res.text();
    sheetRows = await new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true, skipEmptyLines: true,
        complete: results => resolve(results.data),
        error: err => reject(err),
      });
    });
    if (onProgress) onProgress(sheetRows, GOOGLE_SHEET_MAIN_LOOT_CSV_URL, null);
    console.log(`[DATA] Loaded ${sheetRows.length} rows from Sheet`);
  } catch (err) {
    console.error('[DATA] main_loot sheet load error:', err);
    if (onProgress) onProgress([], GOOGLE_SHEET_MAIN_LOOT_CSV_URL, err);
    // SheetRows leeg laten maar niet stoppen: static kan fallback zijn
  }

  // 3. Je kunt nu samenvoegen of retourneren afhankelijk van je behoefte
  //    Bijvoorbeeld: sheetRows toevoegen aan static events op een manier die bij je frontend past

  // Voorbeeld: SheetRow → Event parser/matcher toevoegen (per eigen format)
  // Hier een simpele merge: static events krijgen loot uit sheetRows toegevoegd als naam/map matcht
  if (allEvents.length && sheetRows.length) {
    // Maak lookup op [eventname+map] of unieke sleutel
    const eventsByKey = {};
    allEvents.forEach(e => {
      const key = `${(e.name || '').trim().toLowerCase()}|${(e.map || '').trim().toLowerCase()}`;
      eventsByKey[key] = e;
      if (!e.loot) e.loot = [];
    });

    sheetRows.forEach(row => {
      const k = `${(row.EventName || '').trim().toLowerCase()}|${(row.MapName || '').trim().toLowerCase()}`;
      if (eventsByKey[k]) {
        // Voeg loot toe aan bestaand event
        eventsByKey[k].loot = eventsByKey[k].loot || [];
        // Uniek per item
        if (
          !eventsByKey[k].loot.some(
            l => l.name === row.Item && l.rarity === row.Rarity
          )
        ) {
          eventsByKey[k].loot.push({
            name: row.Item,
            id: row.ItemID ? Number(row.ItemID) : undefined,
            rarity: row.Rarity,
            guaranteed: row.Guaranteed === 'Yes',
            // Vul overige kolommen in desgewenst!
          });
        }
      } else {
        // Optioneel: onbekende loot/event? Voeg apart toe
      }
    });

    // Output alle events uit lookup:
    return Object.values(eventsByKey);
  }
  if (allEvents.length) return allEvents;
  if (sheetRows.length) {
    // Sheet-only modus: maak simpel event-achtige structuur van sheet als static data ontbreekt
    return sheetRows.map(row => ({
      name: row.EventName,
      map: row.MapName,
      expansion: row.Expansion,
      loot: [{
        name: row.Item,
        id: row.ItemID ? Number(row.ItemID) : undefined,
        rarity: row.Rarity,
        guaranteed: row.Guaranteed === 'Yes',
        // ...
      }]
      // Meer velden (bv. waypoints, code) kan je toevoegen
    }));
  }
  // Beide leeg? Error
  throw new Error('Geen eventdata geladen uit JSON of Sheet!');
}
