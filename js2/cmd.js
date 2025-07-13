// CONFIGURATION
const DATA_URLS = [
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
];

// STATE
let allEvents = [];
let filteredEvents = [];
let sortKey = 'name';
let sortAsc = true;
const itemCache = {}; // id -> item info

// UTILS
function createWikiUrl(nameOrCode) {
  // Prefer name; fallback to chat code
  if (!nameOrCode) return '#';
  if (nameOrCode.startsWith('[&')) {
    return `https://wiki.guildwars2.com/wiki/Special:Search?search=${encodeURIComponent(nameOrCode)}`;
  }
  return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(nameOrCode.replace(/ /g, '_'))}`;
}

// Fetch item info from GW2 API
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
    itemCache[id] = info;
    return info;
  } catch {
    itemCache[id] = null;
    return null;
  }
}

// DATA LOADING
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

// Enrich loot items with GW2 API info where possible
async function enrichLootWithApi() {
  const lootItems = [];
  allEvents.forEach(ev => {
    (ev.loot || []).forEach(item => {
      if (item.id && !itemCache[item.id]) lootItems.push(item.id);
    });
  });
  // Remove duplicates
  const uniqueIds = [...new Set(lootItems)];
  await Promise.all(uniqueIds.map(id => fetchItemInfo(id)));
}

// GROUPING
function groupEvents(events) {
  const expansions = {};
  events.forEach(ev => {
    if (!expansions[ev.expansion]) expansions[ev.expansion] = {};
    if (!expansions[ev.expansion][ev.sourceName]) expansions[ev.expansion][ev.sourceName] = [];
    expansions[ev.expansion][ev.sourceName].push(ev);
  });
  return expansions;
}

// FILTER & SORT
function applyFilters() {
  let query = document.getElementById('search').value.toLowerCase();
  filteredEvents = allEvents.filter(ev =>
    ev.name.toLowerCase().includes(query) ||
    ev.map.toLowerCase().includes(query) ||
    (ev.loot && ev.loot.some(item => (item.name && item.name.toLowerCase().includes(query))))
  );
  filteredEvents.sort((a, b) => {
    let vA, vB;
    if (sortKey === 'value') {
      // Use vendor_value of first loot item (if available)
      vA = (a.loot && a.loot[0] && a.loot[0].id && itemCache[a.loot[0].id]) ? itemCache[a.loot[0].id].vendor_value : 0;
      vB = (b.loot && b.loot[0] && b.loot[0].id && itemCache[b.loot[0].id]) ? itemCache[b.loot[0].id].vendor_value : 0;
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

// RENDER
function render() {
  const container = document.getElementById('events');
  container.innerHTML = '';
  const groups = groupEvents(filteredEvents);
  Object.entries(groups).forEach(([expansion, sources]) => {
    const expDiv = document.createElement('div');
    expDiv.className = 'expansion';
    expDiv.innerHTML = `<h2>${expansion}</h2>`;
    Object.entries(sources).forEach(([source, events]) => {
      const srcDiv = document.createElement('div');
      srcDiv.className = 'source';
      srcDiv.innerHTML = `<h3>${source}</h3>`;
      events.forEach(ev => {
        // Loot list with API info or wiki fallback
        const lootItems = (ev.loot || []).map(item => {
          let displayName = item.name || item.id || item.code || 'Unknown Item';
          let wikiUrl = item.id && itemCache[item.id] && itemCache[item.id].wiki
            ? itemCache[item.id].wiki
            : createWikiUrl(item.name || item.code);
          let icon = item.id && itemCache[item.id] && itemCache[item.id].icon
            ? `<img src="${itemCache[item.id].icon}" alt="" class="loot-icon">`
            : '';
          let vendorValue = item.id && itemCache[item.id] && typeof itemCache[item.id].vendor_value === 'number'
            ? ` - ${itemCache[item.id].vendor_value} coins`
            : '';
          let chatLink = item.id && itemCache[item.id] && itemCache[item.id].chat_link
            ? ` <code>${itemCache[item.id].chat_link}</code>`
            : (item.code ? ` <code>${item.code}</code>` : '');
          return `<li>
            ${icon}
            <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer">${displayName}</a>
            ${vendorValue}
            ${chatLink}
          </li>`;
        }).join('');
        const lootSection = lootItems
          ? `<div class="loot-section">
              <button class="toggle-loot" onclick="this.nextElementSibling.classList.toggle('show')">Show/Hide Loot</button>
              <ul class="loot-list">${lootItems}</ul>
            </div>`
          : '';
        const firstItem = (ev.loot && ev.loot[0]) ? (ev.loot[0].name || ev.loot[0].id || ev.loot[0].code) : '';
        let firstItemValue = '';
        if (ev.loot && ev.loot[0] && ev.loot[0].id && itemCache[ev.loot[0].id]) {
          firstItemValue = itemCache[ev.loot[0].id].vendor_value;
        }
        const eventWikiUrl = createWikiUrl(ev.name);
        srcDiv.innerHTML += `
          <div class="event">
            <div class="copy-bar">
              <input type="text" value="${ev.name} | ${ev.map} | ${firstItem}${firstItemValue ? ' (' + firstItemValue + ' coins)' : ''}" readonly>
              <button onclick="navigator.clipboard.writeText(this.previousElementSibling.value)">Copy</button>
            </div>
            <div class="event-info">
              <a href="${eventWikiUrl}" target="_blank" rel="noopener noreferrer" class="event-name">${ev.name}</a>
              <span class="event-map">${ev.map}</span>
              <span class="event-code">${ev.code ? `<code>${ev.code}</code>` : ''}</span>
            </div>
            ${lootSection}
          </div>
        `;
      });
      expDiv.appendChild(srcDiv);
    });
    container.appendChild(expDiv);
  });
}

// EVENT LISTENERS
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
