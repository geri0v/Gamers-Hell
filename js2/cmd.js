// CONFIGURATION
const DATA_URLS = [
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
  // Add more JSON URLs as needed
];

const OTC_CSV_URL = 'https://raw.githubusercontent.com/otc-cirdan/gw2-items/master/items.csv';

let allEvents = [];
let filteredEvents = [];
let sortKey = 'name';
let sortAsc = true;
const itemCache = {};
const tpCache = {};
const otcCsvCache = {};

let coreTyriaCollapsed = false;
const coreTyriaSourcesCollapsed = {};

// --- CSV Loader for OTC Cirdan GW2 Items ---
async function loadOtcCsv() {
  if (Object.keys(otcCsvCache).length > 0) return;
  try {
    const res = await fetch(OTC_CSV_URL);
    const text = await res.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      if (row.length !== headers.length) continue;
      const obj = {};
      headers.forEach((h, idx) => obj[h.trim()] = row[idx]?.trim());
      if (obj.id) otcCsvCache[obj.id] = obj;
      if (obj.name) otcCsvCache[obj.name.toLowerCase()] = obj;
      if (obj.chatcode) otcCsvCache[obj.chatcode] = obj;
    }
  } catch {}
}

// --- Wiki Link Builder ---
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

// --- Event Wiki Link ---
function createEventWikiUrl(event) {
  if (event.name) {
    return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(event.name.replace(/ /g, '_'))}`;
  }
  return '#';
}

// --- Coin Formatter ---
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

// --- Most Valuable Loot ---
function getMostValuableLoot(lootArr) {
  let maxValue = -1, maxItem = null;
  lootArr.forEach(item => {
    let value = (item.id && itemCache[item.id])
      ? (itemCache[item.id].tp_value ?? itemCache[item.id].vendor_value ?? 0)
      : 0;
    if (value > maxValue) {
      maxValue = value;
      maxItem = item;
    }
  });
  return maxItem || (lootArr[0] || null);
}

// --- Live TP Value (Trading Post) Fallback ---
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
  } catch {}
  try {
    const bltcRes = await fetch(`https://api.gw2bltc.com/price/${itemId}`);
    if (bltcRes.ok) {
      const data = await bltcRes.json();
      if (data && typeof data.sell === 'number') {
        tpCache[itemId] = data.sell;
        return data.sell;
      }
    }
  } catch {}
  return null;
}

// --- Item Info Loader (API -> OTC CSV -> Wiki) ---
async function fetchItemInfo(item) {
  // Try by ID
  if (item.id && itemCache[item.id]) return itemCache[item.id];
  if (item.id) {
    try {
      const response = await fetch(`https://api.guildwars2.com/v2/items/${item.id}`);
      if (response.ok) {
        const data = await response.json();
        const info = {
          name: data.name,
          vendor_value: data.vendor_value,
          chat_link: data.chat_link,
          icon: data.icon,
          accountbound: data.flags?.includes('AccountBound') || data.flags?.includes('AccountBoundOnUse'),
          wiki: createWikiUrl({id: item.id}),
        };
        // TP value
        const tpValue = await fetchTPValue(item.id);
        if (tpValue !== null) info.tp_value = tpValue;
        itemCache[item.id] = info;
        return info;
      }
    } catch {}
  }
  // Try OTC CSV by chat code, then name
  await loadOtcCsv();
  let otc = null;
  if (item.code && otcCsvCache[item.code]) otc = otcCsvCache[item.code];
  if (!otc && item.name && otcCsvCache[item.name.toLowerCase()]) otc = otcCsvCache[item.name.toLowerCase()];
  if (!otc && item.id && otcCsvCache[item.id]) otc = otcCsvCache[item.id];
  if (otc) {
    const info = {
      name: otc.name,
      vendor_value: otc.vendor_value ? parseInt(otc.vendor_value) : undefined,
      chat_link: otc.chatcode,
      icon: otc.icon,
      accountbound: otc.bound === 'AccountBound',
      wiki: createWikiUrl({name: otc.name}),
    };
    itemCache[item.id || otc.name] = info;
    return info;
  }
  // Fallback: minimal info, try wiki by name
  return {
    name: item.name || item.id || item.code || 'Unknown Item',
    wiki: createWikiUrl(item),
    accountbound: false,
  };
}

// --- Data Loader ---
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

// --- Enrich Loot with API/CSV Info ---
async function enrichLootWithApi() {
  const lootItems = [];
  allEvents.forEach(ev => {
    (ev.loot || []).forEach(item => {
      if (item.id && !itemCache[item.id]) lootItems.push(item);
      else if (item.code && !itemCache[item.code]) lootItems.push(item);
      else if (item.name && !itemCache[item.name]) lootItems.push(item);
    });
  });
  // Fetch all unique items
  for (const item of lootItems) {
    await fetchItemInfo(item);
  }
}

// --- Group Events ---
function groupEvents(events) {
  const expansions = {};
  events.forEach(ev => {
    if (!expansions[ev.expansion]) expansions[ev.expansion] = {};
    if (!expansions[ev.expansion][ev.sourceName]) expansions[ev.expansion][ev.sourceName] = [];
    expansions[ev.expansion][ev.sourceName].push(ev);
  });
  return expansions;
}

// --- Filtering and Sorting ---
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
        ? (itemCache[getMostValuableLoot(a.loot, itemCache).id].tp_value ?? itemCache[getMostValuableLoot(a.loot, itemCache).id].vendor_value ?? 0)
        : 0;
      vB = (b.loot && getMostValuableLoot(b.loot, itemCache) && getMostValuableLoot(b.loot, itemCache).id && itemCache[getMostValuableLoot(b.loot, itemCache).id])
        ? (itemCache[getMostValuableLoot(b.loot, itemCache).id].tp_value ?? itemCache[getMostValuableLoot(b.loot, itemCache).id].vendor_value ?? 0)
        : 0;
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

// --- Collapsing ---
function toggleCoreTyria() {
  coreTyriaCollapsed = !coreTyriaCollapsed;
  render();
}
function toggleCoreTyriaSource(source) {
  coreTyriaSourcesCollapsed[source] = !coreTyriaSourcesCollapsed[source];
  render();
}

// --- Copy nudge helper ---
function showCopyNudge(btn) {
  let nudge = document.createElement('span');
  nudge.className = 'copy-nudge';
  nudge.textContent = 'Copied!';
  btn.parentElement.appendChild(nudge);
  setTimeout(() => nudge.remove(), 1200);
}

// --- Main Render ---
function render() {
  const container = document.getElementById('events');
  container.innerHTML = '';
  const groups = groupEvents(filteredEvents);

  Object.entries(groups).forEach(([expansion, sources]) => {
    const expId = `expansion-${expansion.replace(/\s+/g, '_')}`;
    const expDiv = document.createElement('div');
    expDiv.className = 'menu-card';
    expDiv.id = expId;

    expDiv.innerHTML = `<h2>${expansion}</h2>`;

    Object.entries(sources).forEach(([source, events]) => {
      const srcId = `${expId}-source-${source.replace(/\s+/g, '_')}`;
      const srcDiv = document.createElement('div');
      srcDiv.className = 'menu-card';
      srcDiv.id = srcId;

      srcDiv.innerHTML = `<h3>${source}</h3>`;

      events.forEach(ev => {
        const eventWikiUrl = createEventWikiUrl(ev);
        const mostValuable = getMostValuableLoot(ev.loot || []);
        const mostValuableName = mostValuable && itemCache[mostValuable.id]
          ? itemCache[mostValuable.id].name || mostValuable.name
          : (mostValuable?.name || mostValuable?.id || mostValuable?.code || '');
        const mostValuableValue = (mostValuable && mostValuable.id && itemCache[mostValuable.id])
          ? splitCoins(itemCache[mostValuable.id].tp_value ?? itemCache[mostValuable.id].vendor_value)
          : '';
        const waypoint = ev.code ? ev.code : (ev.map || '');
        const copyValue = `${ev.name} | ${waypoint} | ${mostValuableName}${mostValuableValue ? ' (' + mostValuableValue.replace(/<[^>]+>/g, '') + ')' : ''}`;

        // Loot items
        const lootItems = (ev.loot || []).map(item => {
          const info = item.id ? itemCache[item.id] : (item.name && itemCache[item.name]) ? itemCache[item.name] : {};
          let displayName = info && info.name ? info.name : (item.name || item.id || item.code || 'Unknown Item');
          let wikiUrl = createWikiUrl(item);
          let icon = info && info.icon ? `<img src="${info.icon}" alt="" class="loot-icon">` : '';
          let value = '';
          if (info && typeof info.tp_value === 'number') {
            value = `<span class="tp-value" title="Trading Post lowest sell">${splitCoins(info.tp_value)} <span style="font-size:0.95em;color:var(--color-accent-emerald);">(TP)</span></span>`;
          } else if (info && typeof info.vendor_value === 'number') {
            value = `<span class="vendor-value">${splitCoins(info.vendor_value)}</span>`;
          } else if (info && info.accountbound) {
            value = `<span class="vendor-value" style="color:var(--color-accent-emerald);">Accountbound</span>`;
          } else {
            value = `<span class="vendor-value" style="color:var(--color-accent-gold);">No Value</span>`;
          }
          let chatLink = info && info.chat_link
            ? ` <code>${info.chat_link}</code>`
            : (item.code ? ` <code>${item.code}</code>` : '');
          return `<li>
            ${icon}
            <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer">${displayName}</a>
            ${value}
            ${chatLink}
          </li>`;
        }).join('');

        const lootSection = lootItems
          ? `<div class="show-hide-section collapsed loot-section">
              <button class="show-hide-toggle" onclick="this.parentElement.classList.toggle('collapsed')">Show/Hide Loot</button>
              <ul class="loot-list copy-paste-area">${lootItems}</ul>
            </div>`
          : '';

        const eventCard = document.createElement('article');
        eventCard.className = 'event-card fullwidth-event-card';
        eventCard.innerHTML = `
          <div class="card-header">
            <h2><a href="${eventWikiUrl}" target="_blank" class="event-name">${ev.name}</a></h2>
          </div>
          <div class="card-body">
            <div class="event-info">
              <span><b>Location:</b> ${ev.map || ''}</span>
              <span><b>Waypoint:</b> ${ev.code ? `<code>${ev.code}</code>` : ''}</span>
            </div>
            <div class="event-loot-summary">
              <b>Best Loot:</b> ${mostValuableName} ${mostValuableValue}
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
      expDiv.appendChild(srcDiv);
    });
    container.appendChild(expDiv);
  });

  if (typeof renderMenu === "function") renderMenu();
}

// --- Expose for menu.js ---
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
