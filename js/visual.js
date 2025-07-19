// js/visual.js
import { fetchAllData } from './data.js';
import { enrichItemsAndPrices, fetchWikiDescription } from './info.js';
import { resolveWaypoints } from './waypoint.js';
import { filterEvents, renderSortButtons, renderFilterBar, renderSearchBar } from './search.js';
import { renderEventGroups } from './card.js';
import { paginate } from './pagination.js';
import { startTerminal, endTerminal, appendTerminal } from './terminal.js';

let allEvents = [];
let currentFilters = {
  searchTerm: '',
  expansion: '',
  region: '',
  rarity: '',
  lootType: '',
  eventName: ''
};
let currentSort = '';
let currentPage = 1;
const pageSize = 25;

function getUnique(list) {
  return [...new Set(list.filter(Boolean))].sort().map(v => ({ val: v, text: v }));
}

function applySort(events, sortKey) {
  return events.slice().sort((a, b) => {
    switch (sortKey) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'map':
        return a.map.localeCompare(b.map);
      case 'value': {
        const aVal = Math.max(...(a.loot || []).map(i => i.price || i.vendorValue || 0));
        const bVal = Math.max(...(b.loot || []).map(i => i.price || i.vendorValue || 0));
        return bVal - aVal;
      }
      default:
        return 0;
    }
  });
}

function updateUI() {
  const filtered = filterEvents(allEvents, currentFilters);
  const sorted = currentSort ? applySort(filtered, currentSort) : filtered;
  const paginated = paginate(sorted, pageSize, currentPage);
  const grouped = groupByMap(paginated);

  const app = document.getElementById('app');
  app.innerHTML = '';

  const topUI = document.createElement('div');
  topUI.className = 'top-ui-bar';

  topUI.appendChild(
    renderSearchBar(term => {
      currentFilters.searchTerm = term;
      currentPage = 1;
      updateUI();
    })
  );

  topUI.appendChild(
    renderFilterBar({
      expansions: getUnique(allEvents.map(e => e.expansion)),
      maps: getUnique(allEvents.map(e => e.map)),
      eventNames: getUnique(allEvents.map(e => e.name)),
      rarities: getUnique(allEvents.flatMap(e => (e.loot || []).map(l => l.rarity))),
      current: currentFilters
    }, (filterKey, filterVal) => {
      currentFilters[filterKey] = filterVal;
      currentPage = 1;
      updateUI();
    })
  );

  topUI.appendChild(
    renderSortButtons(key => {
      currentSort = key;
      currentPage = 1;
      updateUI();
    })
  );

  app.appendChild(topUI);
  app.appendChild(renderEventGroups(grouped));

  if (!document.getElementById('infinite-scroll-sentinel')) {
    const sentinel = document.createElement('div');
    sentinel.id = 'infinite-scroll-sentinel';
    sentinel.style.height = '1px';
    app.appendChild(sentinel);
    setupInfiniteScroll();
  }
}

function groupByMap(events) {
  const grouped = {};
  for (const ev of events) {
    if (!grouped[ev.map]) grouped[ev.map] = [];
    grouped[ev.map].push(ev);
  }
  return Object.entries(grouped).map(([mapName, items]) => ({
    map: mapName,
    items
  }));
}

function setupInfiniteScroll() {
  const sentinel = document.getElementById('infinite-scroll-sentinel');
  if (!sentinel) return;
  if (window.infiniteScrollObserver) {
    window.infiniteScrollObserver.disconnect();
  }
  window.infiniteScrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      const filtered = filterEvents(allEvents, currentFilters);
      if (paginate(filtered, pageSize, currentPage).length < filtered.length) {
        currentPage++;
        updateUI();
      }
    }
  }, { root: null, threshold: 1 });
  window.infiniteScrollObserver.observe(sentinel);
}

async function enrichEvents(rawEvents) {
  const uniqueItemIds = new Set();
  rawEvents.forEach(event => {
    (event.loot || []).forEach(item => item.id && uniqueItemIds.add(item.id));
  });
  const itemIds = [...uniqueItemIds];
  const enrichedItems = await enrichItemsAndPrices(itemIds);
  const itemMap = new Map(enrichedItems.map(item => [item.id, item]));

  const chatcodes = rawEvents
    .map(e => (e.chatcode || e.code || '').trim())
    .filter(code => code.length > 5);

  const waypointMap = await resolveWaypoints(chatcodes);

  return await Promise.all(
    rawEvents.map(async event => {
      const code = (event.chatcode || event.code || '').trim();
      const wp = waypointMap[code] || {};
      event.code = code;
      event.waypointName = wp.name || null;
      event.waypointWikiLink = wp.wiki || null;
      event.wikiLink = event.name
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.name.replace(/ /g, "_"))}`
        : null;
      event.mapWikiLink = event.map
        ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.map.replace(/ /g, "_"))}`
        : null;
      event.description = '';
      // Optioneel: wiki description, kan traag zijn bij veel events
      // const descRaw = await fetchWikiDescription(event.name || wp.name || '');
      // const match = descRaw?.match(/^(.+?[.!?])\s*(.+?[.!?])/);
      // event.description = match ? `${match[1]} ${match[2]}` : descRaw;
      event.loot = (event.loot || []).map(l => {
        const enriched = l.id ? itemMap.get(l.id) || {} : {};
        const name = enriched.name || l.name;
        const wikiLink = name
          ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`
          : null;
        return {
          ...l,
          name,
          icon: enriched.icon || null,
          wikiLink,
          accountBound: enriched.flags?.includes("AccountBound") || false,
          chatcode: enriched.chat_link || null,
          vendorValue: enriched.vendor_value ?? null,
          price: enriched.price ?? null,
          type: enriched.type ?? null,
          rarity: enriched.rarity || l.rarity || null,
          guaranteed: !!l.guaranteed
        };
      });
      return event;
    })
  );
}

async function boot() {
  startTerminal();
  appendTerminal('⚡ Loading event & loot database...', 'info');
  allEvents = [];
  currentPage = 1;
  try {
    const loadedEvents = await fetchAllData((data, url, err) => {
      if (err) appendTerminal(`[DATA] Error at ${url}: ${err.message || err}`, 'error');
    });
    if (!loadedEvents || !loadedEvents.length) {
      appendTerminal('Geen events gevonden in data!', 'error');
      return endTerminal(false);
    }
    appendTerminal(`✓ Loaded ${loadedEvents.length} events (enhancing...)`, 'progress');
    allEvents = await enrichEvents(loadedEvents);
    appendTerminal(`✓ Enriched ${allEvents.length} events.`, 'success');
    updateUI();
    endTerminal(true);
  } catch (err) {
    appendTerminal('🔥 Fout bij laden data: ' + (err.message || err), 'error');
    endTerminal(false);
    console.error(err);
  }
}

window.addEventListener('DOMContentLoaded', boot);
