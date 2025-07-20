// js/infoload.js
import { fetchAllData } from './data.js';
import * as Info from './info.js';


/**
 * Laad events en enrich (ALLEEN op basis van jouw eigen loot, met GW2Treasures bulk + GW2 API fallback).
 * Alles wat events heeft, krijgt enrichment; alles wat niet bestaat volgens deze bronnen, verdwijnt.
 * Context wordt altijd verrijkt met wiki etc.
 * 
 * @param {function=} onProgress - Optioneel per-event progress callback
 * @returns {Promise<Array>} - Verrijkte eventlijst 
 */
export async function loadAndEnrichData(onProgress = null) {
  const events = await fetchAllData(onProgress);
  const enriched = await fastEnrichEvents(events);

  // Optioneel: progress per event
  if (onProgress) enriched.forEach(onProgress);

  return enriched;
}
