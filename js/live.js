// live.js
// Dynamische, autoschaalbare enrichment-module voor GW2 events/items (>10.000)
// ↳ Geen lokale datasets, alles gebeurt live via GW2 API tijdens runtime
// ↳ Fuzzy-matching met hoge nauwkeurigheid op basis van live opgehaalde officiële itemnamen
// ↳ Volledige enrichment: name fix, id, rarity, price, bound, collectible, wiki-link, TP-link, enz.
// ↳ Werkt direct op GitHub Pages (browser-only, geen localStorage, geen backend, geen externe dumps)

import { fetchAllData } from "./data.js";

// ------ Helpers ------

function levenshtein(a, b) {
  if (a === b) return 0;
  const alen = a.length, blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  let matrix = Array.from({length: alen + 1}, (_, i) => [i]);
  for (let j = 0; j <= blen; j++) matrix[0][j] = j;
  for (let i = 1; i <= alen; i++)
    for (let j = 1; j <= blen; j++)
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,
        matrix[i][j-1] + 1,
        matrix[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)
      );
  return matrix[alen][blen];
}
function normalized(name) {
  return name
    .toLowerCase()
    .replace(/[  _\-'"`~.()]/g, "") // ook non-breaking space
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function fuzzyMatchName(inputName, validNamesMap) {
  let name = normalized(inputName || "");
  let bestScore = -1, bestName = null, bestID = null;
  for (let [wikiName, id] of validNamesMap.entries()) {
    let cand = normalized(wikiName);
    let dist = levenshtein(name, cand);
    let maxlen = Math.max(name.length, cand.length);
    let score = maxlen > 0 ? 1.0 - dist / maxlen : 0;
    if (score > bestScore) { bestScore = score; bestName = wikiName; bestID = id; }
    if (score >= 0.995) break; // superscherp
  }
  return { score: bestScore, match: bestName, id: bestID };
}

// Live referentie-ophalen GW2 API (>20.000 items, batches)
async function fetchAllItemNames() {
  let ids = await fetch("https://api.guildwars2.com/v2/items").then(r => r.json());
  let valid = [];
  for (let i = 0; i < ids.length; i += 200) {
    let chunk = ids.slice(i, i + 200);
    let result = await fetch(`https://api.guildwars2.com/v2/items?ids=${chunk.join(",")}`).then(r => r.json());
    for (let it of result) if (it.name && it.id) valid.push([it.name, it.id]);
  }
  return new Map(valid); // Map<name, id>
}
async function fetchItemDetails(ids) {
  let details = {};
  for (let i = 0; i < ids.length; i += 200) {
    let chunk = ids.slice(i, i + 200);
    let arr = await fetch(`https://api.guildwars2.com/v2/items?ids=${chunk.join(",")}`).then(r => r.json());
    for (let it of arr) details[it.id] = it;
  }
  return details;
}
async function fetchTPDetails(ids) {
  let details = {};
  for (let i = 0; i < ids.length; i += 200) {
    let chunk = ids.slice(i, i + 200);
    let arr = await fetch(`https://api.guildwars2.com/v2/commerce/prices?ids=${chunk.join(",")}`).then(r => r.json());
    for (let it of arr) details[it.id] = it;
  }
  return details;
}
function WIKI_URL(name) {
  return `https://wiki.guildwars2.com/wiki/${encodeURIComponent((name || "").replace(/ /g, "_"))}`;
}
function TP_URL(id) {
  return id ? `https://www.gw2bltc.com/en/item/${id}` : undefined;
}

// ------- MAIN: volledig live, geen locale datasets ----------

/**
 * @param {function(phase: string, info: object):void} onPartialUpdate - optioneel, wordt aangeroepen tijdens progressie.
 * @returns {Promise<Array>} events: flat enriched array klaar om te renderen/door te geven aan visual.js
 */
export async function loadAndEnrichData(onPartialUpdate = null) {
  let events = await fetchAllData();
  
  // 1. Laad live alle geldige itemnamen→id uit GW2 API
  let itemNameMap = await fetchAllItemNames(); // Map<real name, id>
  if (onPartialUpdate) onPartialUpdate("itemnamelist", { total: itemNameMap.size });

  // 2. Fuzzy match sheet/flat array lootnamen naar live id
  let allItemIDs = new Set();
  let unmatched = [];
  let N = events.length;
  for (let i = 0; i < N; ++i) {
    let ev = events[i];
    for (let loot of ev.loot || []) {
      let { score, match, id } = fuzzyMatchName(loot.name, itemNameMap);
      loot.fuzzyScore = score;
      if (score >= 0.995 && id) {
        loot.name = match;
        loot.id = id;
        loot.fuzzyStatus = 'PASS';
        allItemIDs.add(id);
      } else {
        loot.fuzzyStatus = 'FAIL';
        loot.name = loot.name + " (?)";
        loot.id = null;
        unmatched.push({ event: ev.name, loot: loot.name, score, match });
      }
    }
    if (onPartialUpdate && i % 100 === 0 && i > 0) onPartialUpdate("fuzzy", { done: i, total: N });
  }
  if (onPartialUpdate) onPartialUpdate("fuzzyComplete", { unmatched });

  // 3. Haal enrichment op voor alle gematchte ids
  const allIdsArray = Array.from(allItemIDs);
  const [itemDetails, tpDetails] = await Promise.all([
    fetchItemDetails(allIdsArray),
    fetchTPDetails(allIdsArray)
  ]);
  if (onPartialUpdate) onPartialUpdate("apiEnrichment", { count: allIdsArray.length });
  
  // 4. Verrijk loot array per event
  for (let i = 0; i < N; ++i) {
    let ev = events[i];
    for (let loot of ev.loot || []) {
      if (loot.id && itemDetails[loot.id]) {
        let it = itemDetails[loot.id];
        loot.rarity = it.rarity || "";
        loot.icon = it.icon || "";
        loot.flags = it.flags || [];
        loot.collectible = it.flags && it.flags.includes("Collectible");
        loot.accountBound = it.flags && it.flags.includes("AccountBound");
        loot.type = it.type || "";
        loot.level = it.level || "";
        loot.wikiLink = WIKI_URL(it.name);
      }
      if (loot.id && tpDetails[loot.id]) {
        let tp = tpDetails[loot.id];
        loot.price = (tp.sells && tp.sells.unit_price) || null;
        loot.buyprice = (tp.buys && tp.buys.unit_price) || null;
        loot.tpLink = TP_URL(loot.id);
      }
    }
    if (onPartialUpdate && i % 250 === 0 && i > 0) onPartialUpdate("enrich", { done: i, total: N });
  }
  if (onPartialUpdate) onPartialUpdate("complete", { total: N, unmatched });
  return events;
}
