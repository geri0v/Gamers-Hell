// == Gamers-Hell: Full Enhanced JS App with Item Enrichment ==

const DATA_URLS = [
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
];
const OTC_CSV_URL = 'https://raw.githubusercontent.com/otc-cirdan/gw2-items/master/items.csv';

let allEvents = [];
let filteredEvents = [];
let sortKey = 'name';
let sortAsc = true;
const expansionCollapsed = {};
const sourceCollapsed = {};
let otcCsvCache = null;

// === OTC CSV Loader ===
async function loadOtcCsv() {
  if (otcCsvCache) return otcCsvCache;
  otcCsvCache = {};
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
  } catch (e) {}
  return otcCsvCache;
}

// === Item Info & Value Lookup ===
async function getItemFullInfo(query) {
  // 1. Try GW2 API by ItemID
  let info = null;
  let itemId = null;
  if (typeof query === 'number' || /^\d+$/.test(query)) {
    itemId = Number(query);
    info = await fetchFromApiById(itemId);
  }
  // 2. Try GW2 API by chatcode (need OTC CSV to map chatcode to id)
  if (!info && typeof query === 'string' && query.startsWith('[&')) {
    const otc = await fetchFromOtcCsv(query);
    if (otc && otc.id) {
      itemId = otc.id;
      info = await fetchFromApiById(itemId);
      if (info) info.chatcode = otc.chatcode;
    }
  }
  // 3. Try GW2 API by name (need OTC CSV to map name to id)
  if (!info && typeof query === 'string') {
    const otc = await fetchFromOtcCsv(query);
    if (otc && otc.id) {
      itemId = otc.id;
      info = await fetchFromApiById(itemId);
      if (info) info.chatcode = otc.chatcode;
    }
  }
  // 4. Try Wiki by name
  if (!info && typeof query === 'string') {
    info = await fetchFromWikiByName(query);
  }
  // 5. Try OTC CSV fallback
  if (!info) {
    const otc = await fetchFromOtcCsv(query);
    if (otc) {
      info = {
        id: otc.id,
        name: otc.name,
        chatcode: otc.chatcode,
        icon: otc.icon,
        vendor_value: otc.vendor_value ? parseInt(otc.vendor_value) : undefined,
        wiki: otc.name ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(otc.name.replace(/ /g, '_'))}` : undefined,
        accountbound: otc.bound === 'AccountBound'
      };
    }
  }
  // 6. If still not found, return minimal info
  if (!info) {
    info = { name: query, wiki: undefined };
  }
  // Attach ItemID for value lookup
  if (!itemId && info.id) itemId = info.id;
  info.id = itemId || info.id;

  // Value
  let tp_value = null, vendor_value = null;
  if (itemId) {
    tp_value = await fetchTpValueById(itemId);
    if (tp_value == null) {
      const bltc = await fetchFromBltcById(itemId);
      if (bltc && bltc.tp_value) tp_value = bltc.tp_value;
    }
  }
  if (typeof info.vendor_value === 'number') vendor_value = info.vendor_value;
  else if (info.vendor_value) vendor_value = parseInt(info.vendor_value);
  else if (!vendor_value && itemId) {
    const otc = await fetchFromOtcCsv(itemId);
    if (otc && otc.vendor_value) vendor_value = parseInt(otc.vendor_value);
  }
  info.tp_value = tp_value;
  info.vendor_value = vendor_value;
  return info;
}

async function fetchFromApiById(itemId) {
  try {
    const resp = await fetch(`https://api.guildwars2.com/v2/items/${itemId}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      id: data.id,
      name: data.name,
      chatcode: data.chat_link,
      icon: data.icon,
      description: data.description,
      rarity: data.rarity,
      type: data.type,
      vendor_value: data.vendor_value,
      flags: data.flags,
      wiki: `https://wiki.guildwars2.com/wiki/${encodeURIComponent(data.name.replace(/ /g, '_'))}`,
      accountbound: data.flags?.includes('AccountBound') || data.flags?.includes('AccountBoundOnUse')
    };
  } catch {
    return null;
  }
}
async function fetchTpValueById(itemId) {
  try {
    const resp = await fetch(`https://api.guildwars2.com/v2/commerce/prices/${itemId}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.sells && typeof data.sells.unit_price === 'number' ? data.sells.unit_price : null;
  } catch {
    return null;
  }
}
async function fetchFromWikiByName(name) {
  if (!name) return null;
  try {
    const url = `https://wiki.guildwars2.com/api.php?action=query&format=json&origin=*&prop=pageprops|info&titles=${encodeURIComponent(name)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.query || !data.query.pages) return null;
    const page = Object.values(data.query.pages)[0];
    if (!page || page.missing) return null;
    return {
      name: page.title,
      wiki: `https://wiki.guildwars2.com/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
    };
  } catch {
    return null;
  }
}
async function fetchFromBltcById(itemId) {
  try {
    const resp = await fetch(`https://api.gw2bltc.com/price/${itemId}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || !data.sell) return null;
    return { tp_value: data.sell };
  } catch {
    return null;
  }
}
async function fetchFromOtcCsv(query) {
  const cache = await loadOtcCsv();
  if (!cache) return null;
  if (typeof query === 'number' || /^\d+$/.test(query)) {
    if (cache[query]) return cache[query];
  }
  if (typeof query === 'string') {
    if (cache[query]) return cache[query];
    if (cache[query.toLowerCase()]) return cache[query.toLowerCase()];
  }
  return null;
}

// === Main Event Rendering ===

function groupEvents(events) {
  const expansions = {};
  events.forEach(ev => {
    const exp = ev.expansion || 'Unknown Expansion';
    const src = ev.sourceName || 'Unknown Source';
    if (!expansions[exp]) expansions[exp] = {};
    if (!expansions[exp][src]) expansions[exp][src] = [];
    expansions[exp][src].push(ev);
  });
  const sortedExpansions = {};
  Object.keys(expansions).sort().forEach(exp => {
    sortedExpansions[exp] = {};
    Object.keys(expansions[exp]).sort().forEach(src => {
      sortedExpansions[exp][src] = expansions[exp][src];
    });
  });
  return sortedExpansions;
}

function showCopyNudge(btn) {
  const parent = btn.parentElement;
  const existing = parent.querySelector('.copy-nudge');
  if (existing) existing.remove();
  let nudge = document.createElement('span');
  nudge.className = 'copy-nudge';
  nudge.textContent = 'Copied!';
  parent.appendChild(nudge);
  setTimeout(() => nudge.remove(), 1200);
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

function renderEvents() {
  const container = document.getElementById('events');
  container.innerHTML = '';
  if (!filteredEvents.length) {
    container.innerHTML = `<div class="empty-state">No events found.</div>`;
    return;
  }
  const groups = groupEvents(filteredEvents);
  Object.entries(groups).forEach(([expansion, sources]) => {
    const expSection = document.createElement('section');
    expSection.className = 'expansion-section';
    const expId = `exp-${expansion.replace(/\W/g, '')}`;
    if (!(expId in expansionCollapsed)) expansionCollapsed[expId] = false;
    const expToggle = document.createElement('button');
    expToggle.className = 'section-title';
    expToggle.innerHTML = `${expansion} <span class="arrow">${expansionCollapsed[expId] ? '&#9654;' : '&#9660;'}</span>`;
    expToggle.setAttribute('aria-expanded', !expansionCollapsed[expId]);
    expSection.appendChild(expToggle);

    const srcContainer = document.createElement('div');
    srcContainer.className = 'sources-container';
    srcContainer.style.display = expansionCollapsed[expId] ? 'none' : '';

    Object.entries(sources).forEach(([source, events]) => {
      const srcId = `${expId}-src-${source.replace(/\W/g, '')}`;
      if (!(srcId in sourceCollapsed)) sourceCollapsed[srcId] = false;
      const srcDiv = document.createElement('div');
      srcDiv.className = 'source-section';
      const srcToggle = document.createElement('button');
      srcToggle.className = 'source-title';
      srcToggle.innerHTML = `${source} <span class="arrow">${sourceCollapsed[srcId] ? '&#9654;' : '&#9660;'}</span>`;
      srcToggle.setAttribute('aria-expanded', !sourceCollapsed[srcId]);
      srcDiv.appendChild(srcToggle);

      const eventList = document.createElement('div');
      eventList.className = 'event-list';
      eventList.style.display = sourceCollapsed[srcId] ? 'none' : '';

      events.forEach((ev, idx) => {
        const lootListId = `loot-list-${expId}-${srcId}-${idx}`;
        let lootRows = '';
        if (Array.isArray(ev.loot) && ev.loot.length) {
          lootRows = ev.loot.map(item => {
            let icon = item.icon ? `<img src="${item.icon}" alt="" class="loot-icon" />` : '';
            let wikiLink = item.name ? `<a href="https://wiki.guildwars2.com/wiki/${encodeURIComponent(item.name.replace(/ /g, '_'))}" target="_blank" rel="noopener" style="margin-left:0.3em;color:var(--color-accent-emerald);text-decoration:underline;">Wiki</a>` : '';
            let sellValue = (typeof item.tp_value === 'number') ? `<span class="tp-value">${splitCoins(item.tp_value)}</span>` : '';
            let vendorValue = (typeof item.vendor_value === 'number') ? `<span class="vendor-value">${splitCoins(item.vendor_value)}</span>` : '';
            let accountBound = item.accountbound ? `<span class="accountbound">Account Bound</span>` : '';
            return `<li>
              ${icon}
              <a href="https://wiki.guildwars2.com/wiki/${encodeURIComponent(item.name.replace(/ /g, '_'))}" target="_blank" rel="noopener">${item.name}</a>
              ${wikiLink}
              ${sellValue}
              ${vendorValue}
              ${accountBound}
            </li>`;
          }).join('');
        } else {
          lootRows = `<li style="color:#888;">No loot info</li>`;
        }
        const card = document.createElement('div');
        card.className = 'event-card fullwidth-event-card';
        card.innerHTML = `
          <div class="card-header">
            <h2 class="event-name">
              <a href="https://wiki.guildwars2.com/wiki/${encodeURIComponent(ev.name.replace(/ /g, '_'))}" target="_blank" rel="noopener">${ev.name || 'Unnamed Event'}</a>
            </h2>
          </div>
          <div class="card-body">
            <div class="event-info">
              <span><b>Location:</b> ${ev.map || ''}</span>
              <span><b>Waypoint:</b> ${ev.code ? `<code>${ev.code}</code>` : ''}</span>
            </div>
            <div class="copy-bar">
              <input type="text" value="${ev.name || ''} | ${ev.code || ''} | ${(ev.loot || []).map(item => item.name).join(', ')}" readonly>
              <button class="copy-btn" type="button">Copy</button>
            </div>
            <button class="show-hide-toggle" type="button" aria-controls="${lootListId}" aria-expanded="false">Show Loot ▼</button>
            <ul class="loot-list copy-paste-area" id="${lootListId}" style="display:none;">
              ${lootRows}
            </ul>
          </div>
        `;
        card.querySelector('.copy-btn').onclick = function() {
          const input = card.querySelector('.copy-bar input');
          navigator.clipboard.writeText(input.value);
          showCopyNudge(this);
        };
        const lootBtn = card.querySelector('.show-hide-toggle');
        const lootList = card.querySelector('.loot-list');
        lootBtn.onclick = function() {
          const isOpen = lootList.style.display === 'block';
          lootList.style.display = isOpen ? 'none' : 'block';
          lootBtn.textContent = isOpen ? 'Show Loot ▼' : 'Hide Loot ▲';
          lootBtn.setAttribute('aria-expanded', !isOpen);
        };
        eventList.appendChild(card);
      });

      srcDiv.appendChild(eventList);

      srcToggle.onclick = function() {
        sourceCollapsed[srcId] = !sourceCollapsed[srcId];
        eventList.style.display = sourceCollapsed[srcId] ? 'none' : '';
        srcToggle.querySelector('.arrow').innerHTML = sourceCollapsed[srcId] ? '&#9654;' : '&#9660;';
        srcToggle.setAttribute('aria-expanded', !sourceCollapsed[srcId]);
      };

      srcContainer.appendChild(srcDiv);
    });

    expToggle.onclick = function() {
      expansionCollapsed[expId] = !expansionCollapsed[expId];
      srcContainer.style.display = expansionCollapsed[expId] ? 'none' : '';
      expToggle.querySelector('.arrow').innerHTML = expansionCollapsed[expId] ? '&#9654;' : '&#9660;';
      expToggle.setAttribute('aria-expanded', !expansionCollapsed[expId]);
    };

    expSection.appendChild(srcContainer);
    container.appendChild(expSection);
  });
}

// Filtering & Sorting
function applyFilters() {
  let query = document.getElementById('search').value.toLowerCase();
  filteredEvents = allEvents.filter(ev =>
    (ev.name && ev.name.toLowerCase().includes(query)) ||
    (ev.map && ev.map.toLowerCase().includes(query)) ||
    (ev.loot && ev.loot.some(item => (item.name && item.name.toLowerCase().includes(query))))
  );
  filteredEvents.sort((a, b) => {
    let vA = a[sortKey] || '', vB = b[sortKey] || '';
    if (typeof vA === 'string') vA = vA.toLowerCase();
    if (typeof vB === 'string') vB = vB.toLowerCase();
    if (vA < vB) return sortAsc ? -1 : 1;
    if (vA > vB) return sortAsc ? 1 : -1;
    return 0;
  });
  renderEvents();
}

// Menu integration: allow menu.js to filter
window.cmd_run = function(cmdString) {
  let match = cmdString.match(/^show expansion "(.+)" source "(.+)"$/i);
  if (match) {
    const [_, exp, src] = match;
    filteredEvents = allEvents.filter(ev => (ev.expansion || 'Unknown Expansion') === exp && (ev.sourceName || 'Unknown Source') === src);
    renderEvents();
    return;
  }
  match = cmdString.match(/^show expansion "(.+)"$/i);
  if (match) {
    const [_, exp] = match;
    filteredEvents = allEvents.filter(ev => (ev.expansion || 'Unknown Expansion') === exp);
    renderEvents();
    return;
  }
  match = cmdString.match(/^show source "(.+)"$/i);
  if (match) {
    const [_, src] = match;
    filteredEvents = allEvents.filter(ev => (ev.sourceName || 'Unknown Source') === src);
    renderEvents();
    return;
  }
  match = cmdString.match(/^show all$/i);
  if (match) {
    filteredEvents = allEvents;
    renderEvents();
    return;
  }
  alert("Unknown command: " + cmdString);
};

// Initial load with loot enrichment
document.addEventListener('DOMContentLoaded', async function() {
  // Fetch all events
  const all = await Promise.all(DATA_URLS.map(async (url) => {
    try {
      const resp = await fetch(url);
      const json = await resp.json();
      let events = [];
      let sourceName = json.sourceName || 'Unknown Source';
      if (Array.isArray(json)) {
        events = json;
      } else if (Array.isArray(json.events)) {
        events = json.events;
      } else if (typeof json === 'object') {
        Object.values(json).forEach(val => {
          if (Array.isArray(val)) events = events.concat(val);
        });
      }
      events.forEach(ev => ev.sourceName = sourceName);
      // Enrich loot items for each event
      if (events.length) {
        for (const ev of events) {
          if (Array.isArray(ev.loot)) {
            for (let i = 0; i < ev.loot.length; i++) {
              const item = ev.loot[i];
              const query = item.id || item.code || item.name;
              if (!query) continue;
              const info = await getItemFullInfo(query);
              ev.loot[i] = { ...item, ...info };
            }
          }
        }
      }
      return events;
    } catch (e) {
      return [];
    }
  }));
  allEvents = all.flat();
  filteredEvents = allEvents;
  renderEvents();
  // Expose menu structure for menu.js
  if (window.renderMenu) {
    const structure = {};
    allEvents.forEach(ev => {
      const exp = ev.expansion || 'Unknown Expansion';
      const src = ev.sourceName || 'Unknown Source';
      if (!structure[exp]) structure[exp] = new Set();
      structure[exp].add(src);
    });
    Object.keys(structure).forEach(k => structure[k] = Array.from(structure[k]));
    window.renderMenu(structure);
  }
  // Search
  document.getElementById('search').addEventListener('input', applyFilters);
  // Sort
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const newSortKey = btn.dataset.sort;
      if (sortKey === newSortKey) sortAsc = !sortAsc;
      else { sortKey = newSortKey; sortAsc = true; }
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });
});
