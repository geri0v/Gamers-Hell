// live.js
import { fetchAllData } from "./data.js";

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
        matrix[i-1][j]+1,
        matrix[i][j-1]+1,
        matrix[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)
      );
  return matrix[alen][blen];
}
function normalized(name) {
  return (name||"")
    .toLowerCase()
    .replace(/[  _\-'"`~.()]/g, "")
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
    if (score >= 0.995) break;
  }
  return { score: bestScore, match: bestName, id: bestID };
}

// Helper: fetch in batch met retry en throttling
async function fetchWithRetry(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      let r = await fetch(url);
      if (r.ok) return await r.json();
      else if (i === attempts-1) throw new Error("Failed: " + r.status + " " + r.statusText);
    } catch (e) {
      if (i === attempts-1) throw e;
      await new Promise(res => setTimeout(res, 400 + Math.random()*300));
    }
  }
}

// Alle itemnamen ophalen, live (duurt ±60s!)
async function fetchAllItemNames(onProgress=null) {
  let ids = await fetchWithRetry("https://api.guildwars2.com/v2/items");
  let valid = [];
  let done = 0;
  for (let i = 0; i < ids.length; i += 180) { // batches van 180 (veilig)
    let chunk = ids.slice(i, i + 180);
    let arr = await fetchWithRetry(`https://api.guildwars2.com/v2/items?ids=${chunk.join(",")}`);
    for (let it of arr) if (it.name && it.id) valid.push([it.name, it.id]);
    done += chunk.length;
    if (onProgress) onProgress(Math.round(100 * done / ids.length));
    await new Promise(res=>setTimeout(res,80 + Math.random()*50));
  }
  return new Map(valid); // Map<name, id>
}
async function fetchItemDetails(ids, onProg=null) {
  let details = {};
  let N = ids.length, done = 0;
  for (let i = 0; i < ids.length; i += 180) {
    let chunk = ids.slice(i, i + 180);
    let arr = await fetchWithRetry(`https://api.guildwars2.com/v2/items?ids=${chunk.join(",")}`);
    for (let it of arr) details[it.id] = it;
    done += chunk.length;
    if (onProg) onProg(Math.round(100 * done / N));
    await new Promise(res => setTimeout(res, 80 + Math.random()*70));
  }
  return details;
}
async function fetchTPDetails(ids, onProg=null) {
  let details = {};
  let N = ids.length, done = 0;
  for (let i = 0; i < ids.length; i += 180) {
    let chunk = ids.slice(i, i + 180);
    let arr = await fetchWithRetry(`https://api.guildwars2.com/v2/commerce/prices?ids=${chunk.join(",")}`);
    for (let it of arr) details[it.id] = it;
    done += chunk.length;
    if (onProg) onProg(Math.round(100 * done / N));
    await new Promise(res => setTimeout(res, 80 + Math.random()*70));
  }
  return details;
}
function WIKI_URL(name) {
  return `https://wiki.guildwars2.com/wiki/${encodeURIComponent((name || "").replace(/ /g, "_"))}`;
}
function TP_URL(id) {
  return id ? `https://www.gw2bltc.com/en/item/${id}` : undefined;
}

/**
 * Dynamische live enrichment pipeline. Doet fuzzy matching, id-toekenning en API enrichment.
 * Gemaakt voor 10k/100k events. Draait browser-only, zonder lokale datasets, veilig op Github Pages.
 */
export async function loadAndEnrichData(onPartialUpdate = null) {
  let events = await fetchAllData();
  if (onPartialUpdate) onPartialUpdate("start", { total: events.length });

  // 1. Haal GW2 items live op, met progress (duurt max 60s maar 100% accuraat)
  if (onPartialUpdate) onPartialUpdate("gw2names", { msg: "Ophalen van GW2 itemlijst..." });
  let itemNameMap = await fetchAllItemNames(p => { if(onPartialUpdate) onPartialUpdate("gw2namesprogress", {p}); });

  // 2. Fuzzy-match, id-assign
  let allItemIDs = new Set();
  let unmatched = [];
  for (let i = 0; i < events.length; ++i) {
    let ev = events[i];
    for (let loot of ev.loot || []) {
      const { score, match, id } = fuzzyMatchName(loot.name, itemNameMap);
      loot.fuzzyScore = score;
      if (score >= 0.995 && id) {
        loot.name = match;
        loot.id = id;
        loot.fuzzyStatus = "PASS";
        allItemIDs.add(id);
      } else {
        loot.fuzzyStatus = "FAIL"; loot.name = loot.name + " (?)"; loot.id = null;
        unmatched.push({ event: ev.name, loot: loot.name, score, match });
      }
    }
    if (onPartialUpdate && i % 100 === 0 && i > 0)
      onPartialUpdate("fuzzy", { done: i, total: events.length });
  }
  if (onPartialUpdate) onPartialUpdate("fuzzyComplete", { unmatched });

  // 3. Verrijk alle loot-regels met details en TP prijs
  const allIdsArray = Array.from(allItemIDs);
  if (onPartialUpdate) onPartialUpdate("apiEnrichment", {count: allIdsArray.length});
  const [itemDetails, tpDetails] = await Promise.all([
    fetchItemDetails(allIdsArray, p=>{ if(onPartialUpdate) onPartialUpdate("itemEnrich", {p}); }),
    fetchTPDetails(allIdsArray, p=>{ if(onPartialUpdate) onPartialUpdate("tpEnrich", {p}); })
  ]);
  if (onPartialUpdate) onPartialUpdate("dataEnriched");

  // 4. Voeg enrichment toe aan alle loots
  for (let i = 0; i < events.length; ++i) {
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
    if (onPartialUpdate && i % 250 === 0 && i > 0) onPartialUpdate("enrich", { done: i, total: events.length });
  }
  if (onPartialUpdate) onPartialUpdate("complete", { total: events.length, unmatched });
  return events;
}
