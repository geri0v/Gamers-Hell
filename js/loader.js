// loader.js

// Utility: Fetch JSON with error handling
async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

// Fetch item details from GW2 API
async function fetchItemDetails(itemId) {
  return await fetchJson(`https://api.guildwars2.com/v2/items/${itemId}`);
}

// Fetch event details from GW2 API (by name, not direct lookup)
async function fetchEventDetails(eventName) {
  // The GW2 API does not provide direct name lookup for events
  // You may need to cache event IDs or use a mapping
  return null; // Placeholder for event enrichment logic
}

// Generate a GW2Wiki link for any name
function generateWikiLink(name) {
  if (!name) return null;
  const baseUrl = 'https://wiki.guildwars2.com/wiki/';
  const encoded = encodeURIComponent(name.replace(/ /g, '_'));
  return `${baseUrl}${encoded}`;
}

// Format price from copper to gold/silver/copper
function formatPrice(copper) {
  if (copper == null) return 'N/A';
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperRemainder = copper % 100;
  return `${gold}g ${silver}s ${copperRemainder}c`;
}

// Main enrichment function
export async function enrichData(data) {
  for (const event of data) {
    // Event wiki links
    event.wikiLink = generateWikiLink(event.name);
    event.mapWikiLink = generateWikiLink(event.map);

    // Event API details (if available)
    // Optionally implement fetchEventDetails(event.name) for eventId/eventApi

    // Enrich loot
    if (Array.isArray(event.loot)) {
      for (const item of event.loot) {
        if (item.id) {
          const details = await fetchItemDetails(item.id);
          if (details) {
            item.icon = details.icon;
            item.wikiLink = generateWikiLink(details.name);
            // Price: fetch from GW2 API commerce endpoint
            // e.g., https://api.guildwars2.com/v2/commerce/prices/[item_id]
            // For brevity, fetch and format price here if needed
            item.accountBound = details.flags ? details.flags.includes('AccountBound') : false;
            item.guaranteed = item.guaranteed || false;
            item.chatCode = details.chat_link || null;
          }
        }
        // Fallbacks (wiki, BLTC, GW2Spidy, GuildJen, CSV) can be added here if API fails
      }
    }
  }
  return data;
}
