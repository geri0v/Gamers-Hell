// cmd.js - GW2 Event & Loot Browser with improved loot list, robust wiki links, and show/hide loot

// CONFIGURATION
const DATA_URLS = [
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
  // Add more JSON URLs here as needed, e.g. Heart of Thorns, PoF, etc.
];

let allEvents = [];
let filteredEvents = [];
let sortKey = 'name';
let sortAsc = true;
const itemCache = {};
const tpCache = {};

let coreTyriaCollapsed = false;
const coreTyriaSourcesCollapsed = {};

// Robust wiki link function: prefers API name, then JSON name, then chat code, then ID
function createWikiUrl(item) {
  if (!item) return '#';
  if (item.id && itemCache[item.id] && itemCache[item.id].name) {
    return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(itemCache[item.id].name.replace(/ /g, '_'))}`;
  }
  if (item.name) {
    return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(item.name.replace(/ /g, '_'))}`;
  }
  if (item.code && item.code.startsWith('[&')) {
    return `https://wiki.guildwars2.com/wiki/Special:Search?search=${encodeURIComponent(item.code)}`;
  }
  if (item.id) {
    return `https://wiki.guildwars2.com/wiki/Special:Search?search=${encodeURIComponent(item.id)}`;
  }
  return '#';
}

function splitCoins(coins) {
  if (typeof coins !== 'number' || isNaN(coins)) return '';
  const gold = Math.floor(coins / 10000);
  const silver = Math.floor((coins % 10000) / 100);
  const copper = coins % 100;
  let str = '';
  if (gold) str += `<span class="gold">${gold}g</span> `;
  if (gold || silver) str += `<span class="silver">${silver}s</span> `;
  str += `<span class="copper">${copper}c</span>`;
  return str.trim();
}

function getMostValuableLoot(lootArr, itemCache) {
  let maxValue = -1, maxItem = null;
  lootArr.forEach(item => {
    let value = (item.id && itemCache[item.id]) ? itemCache[item.id].vendor_value : 0;
    if (value > maxValue) {
      maxValue = value;
      maxItem = item;
    }
  });
  return maxItem || (lootArr[0] || null);
}

// Live TP Value (Trading Post) Fallback
async function fetchTPValue(itemId) {
  try {
    const apiRes = await fetch(`https://api.guildwars2.com/v2/commerce/prices/${itemId}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.sells && typeof data.sells.unit_price === 'number') {
        tpCache[itemId] = data.sells.unit_price;
        return data.sells.unit_price;
      }
    }
  } catch (e) {}
  try {
    const bltcRes = await fetch(`https://api.gw2bltc.com/price/${itemId}`);
    if (bltcRes.ok) {
      const data = await bltcRes.json();
      if (data && typeof data.sell === 'number') {
        tpCache[itemId] = data.sell;
        return data.sell;
      }
    }
  } catch (e) {}
  return null;
}

async function fetchItemInfo(id) {
  if (itemCache[id]) return itemCache[id];
  try {
    const response = await fetch(`https://api.guildwars2.com/v2/items/${id}`);
    if (!response.ok) throw new Error('Not found');
    const data = await response.json();
    const info = {
      name: data.name,
      vendor_value: data.vendor_value,
      chat_link: data.chat_link,
      icon: data.icon,
      wiki: createWikiUrl(data.name),
    };
    const tpValue = await fetchTPValue(id);
    if (tpValue !== null) {
      info.tp_value = tpValue;
    }
    itemCache[id] = info;
    return info;
  } catch {
    itemCache[id] = null;
    return null;
  }
}

async function loadData() {
  const allData = await Promise.all(DATA_URLS.map(url => fetch(url).then(r => r.json())));
  let events = [];
  allData.forEach(data => {
    if (data.events && Array.isArray(data.events)) {
      data.events.forEach(event => {
        events.push({
          ...event,
          sourceName: data.sourceName || 'Unknown Source'
        });
      });
    }
  });
  allEvents = events;
  filteredEvents = events;
  await enrichLootWithApi();
  render();
}

async function enrichLootWithApi() {
  const lootItems = [];
  allEvents.forEach(ev => {
    (ev.loot || []).forEach(item => {
      if (item.id && !itemCache[item.id]) lootItems.push(item.id);
    });
  });
  const uniqueIds = [...new Set(lootItems)];
  await Promise.all(uniqueIds.map(id => fetchItemInfo(id)));
}

function groupEvents(events) {
  const expansions = {};
  events.forEach(ev => {
    if (!expansions[ev.expansion]) expansions[ev.expansion] = {};
    if (!expansions[ev.expansion][ev.sourceName]) expansions[ev.expansion][ev.sourceName] = [];
    expansions[ev.expansion][ev.sourceName].push(ev);
  });
  return expansions;
}

function applyFilters() {
  let query = document.getElementById('search').value.toLowerCase();
  filteredEvents = allEvents.filter(ev =>
    ev.name.toLowerCase().includes(query) ||
    (ev.map && ev.map.toLowerCase().includes(query)) ||
    (ev.loot && ev.loot.some(item => (item.name && item.name.toLowerCase().includes(query))))
  );
  filteredEvents.sort((a, b) => {
    let vA, vB;
    if (sortKey === 'value') {
      vA = (a.loot && getMostValuableLoot(a.loot, itemCache) && getMostValuableLoot(a.loot, itemCache).id && itemCache[getMostValuableLoot(a.loot, itemCache).id])
        ? itemCache[getMostValuableLoot(a.loot, itemCache).id].vendor_value : 0;
      vB = (b.loot && getMostValuableLoot(b.loot, itemCache) && getMostValuableLoot(b.loot, itemCache).id && itemCache[getMostValuableLoot(b.loot, itemCache).id])
        ? itemCache[getMostValuableLoot(b.loot, itemCache).id].vendor_value : 0;
    } else {
      vA = a[sortKey] || '';
      vB = b[sortKey] || '';
      if (typeof vA === 'string') vA = vA.toLowerCase();
      if (typeof vB === 'string') vB = vB.toLowerCase();
    }
    if (vA < vB) return sortAsc ? -1 : 1;
    if (vA > vB) return sortAsc ? 1 : -1;
    return 0;
  });
  render();
}

function toggleCoreTyria() {
  coreTyriaCollapsed = !coreTyriaCollapsed;
  render();
}
function toggleCoreTyriaSource(source) {
  coreTyriaSourcesCollapsed[source] = !coreTyriaSourcesCollapsed[source];
  render();
}

// Copy nudge helper
function showCopyNudge(btn) {
  let nudge = document.createElement('span');
  nudge.className = 'copy-nudge';
  nudge.textContent = 'Copied!';
  btn.parentElement.appendChild(nudge);
  setTimeout(() => nudge.remove(), 1200);
}

// Main Render
function render() {
  const container = document.getElementById('events');
  container.innerHTML = '';
  const groups = groupEvents(filteredEvents);

  Object.entries(groups).forEach(([expansion, sources]) => {
    const expId = `expansion-${expansion.replace(/\s+/g, '_')}`;
    const expDiv = document.createElement('div');
    expDiv.className = 'menu-card';
    expDiv.id = expId;

    // Expansion header
    if (expansion === 'Core Tyria') {
      expDiv.innerHTML = `<h2 style="cursor:pointer;" onclick="toggleCoreTyria()">
        ${coreTyriaCollapsed ? '▶' : '▼'} Core Tyria
      </h2>`;
    } else {
      expDiv.innerHTML = `<h2>${expansion}</h2>`;
    }

    // Sources
    if (expansion !== 'Core Tyria' || !coreTyriaCollapsed) {
      Object.entries(sources).forEach(([source, events]) => {
        const srcId = `${expId}-source-${source.replace(/\s+/g, '_')}`;
        const srcDiv = document.createElement('div');
        srcDiv.className = 'menu-card';
        srcDiv.id = srcId;

        // Source header
        if (expansion === 'Core Tyria') {
          if (!(source in coreTyriaSourcesCollapsed)) coreTyriaSourcesCollapsed[source] = false;
          srcDiv.innerHTML = `<h3 style="cursor:pointer;" onclick="toggleCoreTyriaSource('${source.replace(/'/g, "\\'")}')">
            ${coreTyriaSourcesCollapsed[source] ? '▶' : '▼'} ${source}
          </h3>`;
        } else {
          srcDiv.innerHTML = `<h3>${source}</h3>`;
        }

        // Events
        if (expansion !== 'Core Tyria' || !coreTyriaSourcesCollapsed[source]) {
          events.forEach(ev => {
            const mostValuable = getMostValuableLoot(ev.loot || [], itemCache);
            const mostValuableName = mostValuable ? (mostValuable.name || mostValuable.id || mostValuable.code) : '';
            const mostValuableValue = (mostValuable && mostValuable.id && itemCache[mostValuable.id])
              ? splitCoins(itemCache[mostValuable.id].vendor_value)
              : '';

            const waypoint = ev.code ? ev.code : (ev.map || '');
            const copyValue = `${ev.name} | ${waypoint} | ${mostValuableName}${mostValuableValue ? ' (' + mostValuableValue.replace(/<[^>]+>/g, '') + ')' : ''}`;

            // Loot items as a list
            const lootItems = (ev.loot || []).map(item => {
              let displayName = (item.id && itemCache[item.id] && itemCache[item.id].name) ? itemCache[item.id].name : (item.name || item.id || item.code || 'Unknown Item');
              let wikiUrl = createWikiUrl(item);
              let icon = item.id && itemCache[item.id] && itemCache[item.id].icon
                ? `<img src="${itemCache[item.id].icon}" alt="" class="loot-icon">`
                : '';
              let vendorValue = item.id && itemCache[item.id] && typeof itemCache[item.id].vendor_value === 'number'
                ? `<span class="vendor-value">${splitCoins(itemCache[item.id].vendor_value)}</span>`
                : '';
              let tpValue = (item.id && itemCache[item.id] && typeof itemCache[item.id].tp_value === 'number')
                ? `<span class="tp-value" title="Trading Post lowest sell">${splitCoins(itemCache[item.id].tp_value)} <span style="font-size:0.95em;color:var(--color-accent-emerald);">(TP)</span></span>`
                : '';
              let chatLink = item.id && itemCache[item.id] && itemCache[item.id].chat_link
                ? ` <code>${itemCache[item.id].chat_link}</code>`
                : (item.code ? ` <code>${item.code}</code>` : '');
              return `<li>
                ${icon}
                <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer">${displayName}</a>
                ${vendorValue}
                ${tpValue}
                ${chatLink}
              </li>`;
            }).join('');

            // Loot section as a collapsible card (always present if loot exists)
            const lootSection = lootItems
              ? `<div class="show-hide-section collapsed loot-section">
                  <button class="show-hide-toggle" onclick="this.parentElement.classList.toggle('collapsed')">Show/Hide Loot</button>
                  <ul class="loot-list copy-paste-area">${lootItems}</ul>
                </div>`
              : '';

            const eventWikiUrl = createWikiUrl({name: ev.name});

            // Render the event as a full-width card!
            const eventCard = document.createElement('article');
            eventCard.className = 'event-card fullwidth-event-card';
            eventCard.innerHTML = `
              <div class="card-header">
                <span class="event-icon">🎲</span>
                <h2><a href="${eventWikiUrl}" target="_blank" class="event-name">${ev.name}</a></h2>
              </div>
              <div class="card-body">
                <div class="event-info">
                  <span class="event-map">${ev.map ? `<b>Location:</b> ${ev.map}` : ''}</span>
                  <span class="event-code">${ev.code ? `<b>Waypoint:</b> <code>${ev.code}</code>` : ''}</span>
                  ${mostValuableName ? `<span class="event-loot"><b>Best Loot:</b> ${mostValuableName} ${mostValuableValue}</span>` : ''}
                </div>
                <div class="copy-bar">
                  <input type="text" value="${copyValue}" readonly>
                  <button onclick="navigator.clipboard.writeText(this.previousElementSibling.value); showCopyNudge(this);">Copy</button>
                </div>
                ${lootSection}
              </div>
            `;
            srcDiv.appendChild(eventCard);
          });
        }
        expDiv.appendChild(srcDiv);
      });
    }
    container.appendChild(expDiv);
  });

  if (typeof renderMenu === "function") renderMenu();
}

window.toggleCoreTyria = toggleCoreTyria;
window.toggleCoreTyriaSource = toggleCoreTyriaSource;
window.getEventGroups = () => groupEvents(filteredEvents);

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  document.getElementById('search').addEventListener('input', applyFilters);
  document.body.addEventListener('click', function (e) {
    if (e.target.classList.contains('sort-btn')) {
      sortKey = e.target.dataset.sort;
      sortAsc = !sortAsc;
      applyFilters();
    }
  });
});
