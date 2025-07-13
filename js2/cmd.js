// gamers-hell.js
// Handles dynamic content for Gamers-Hell app (no CSS or layout injection)

const jsonSources = [
  {
    name: "Temples of Orr",
    url: "https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json"
  },
  {
    name: "Valuable Events",
    url: "https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json"
  }
];

window.allEvents = [];
window.currentSearch = '';
window.currentSort = 'name';

async function fetchAllEvents() {
  const all = await Promise.all(jsonSources.map(async (src) => {
    try {
      const resp = await fetch(src.url);
      const json = await resp.json();
      let events = [];
      let sourceName = json.sourceName || src.name || 'Unknown Source';
      if (Array.isArray(json)) {
        events = json;
      } else if (Array.isArray(json.events)) {
        events = json.events;
      } else if (typeof json === 'object') {
        Object.values(json).forEach(val => {
          if (Array.isArray(val)) events = events.concat(val);
        });
      }
      events.forEach(ev => ev._sourceName = sourceName);
      return events;
    } catch (e) {
      return [];
    }
  }));
  return all.flat();
}

function groupEvents(events) {
  const expansions = {};
  events.forEach(ev => {
    const exp = ev.expansion || 'Unknown Expansion';
    const src = ev._sourceName || 'Unknown Source';
    if (!expansions[exp]) expansions[exp] = {};
    if (!expansions[exp][src]) expansions[exp][src] = [];
    expansions[exp][src].push(ev);
  });
  return expansions;
}

async function fetchTPPricesAndIcons(itemIds) {
  if (!itemIds.length) return { prices: {}, icons: {} };
  const chunkSize = 200;
  let prices = {}, icons = {};
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    const chunk = itemIds.slice(i, i + chunkSize);
    try {
      const resp = await fetch(`https://api.guildwars2.com/v2/commerce/prices?ids=${chunk.join(',')}`);
      const data = await resp.json();
      data.forEach(entry => {
        prices[entry.id] = {
          sell: entry.sells && entry.sells.unit_price ? entry.sells.unit_price : 0,
          buy: entry.buys && entry.buys.unit_price ? entry.buys.unit_price : 0,
          demand: entry.buys && entry.buys.quantity ? entry.buys.quantity : 0
        };
      });
    } catch (e) {}
  }
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    const chunk = itemIds.slice(i, i + chunkSize);
    try {
      const resp = await fetch(`https://api.guildwars2.com/v2/items?ids=${chunk.join(',')}`);
      const data = await resp.json();
      data.forEach(entry => {
        icons[entry.id] = entry.icon;
      });
    } catch (e) {}
  }
  return { prices, icons };
}

function formatGW2Currency(price) {
  if (!price) return '';
  const gold = Math.floor(price / 10000);
  const silver = Math.floor((price % 10000) / 100);
  const copper = price % 100;
  return `${gold}g ${silver}s ${copper}c`;
}

function eventMatchesSearch(event, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if ((event.name && event.name.toLowerCase().includes(q)) ||
      (event.map && event.map.toLowerCase().includes(q)) ||
      (event.code && event.code.toLowerCase().includes(q)) ||
      (event.notes && event.notes.toLowerCase().includes(q))) {
    return true;
  }
  if (Array.isArray(event.loot)) {
    for (const item of event.loot) {
      if ((item.name && item.name.toLowerCase().includes(q)) ||
          (item.code && item.code.toLowerCase().includes(q))) {
        return true;
      }
    }
  }
  if (Array.isArray(event.bosses)) {
    for (const boss of event.bosses) {
      if (boss && boss.toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function renderEventCard(event, idx, searchQuery, tpPrices, tpIcons, maxSellValue) {
  let lootRows = '';
  if (Array.isArray(event.loot) && event.loot.length) {
    lootRows = event.loot.map(item => {
      let tp = tpPrices[item.id] || {};
      let icon = tpIcons[item.id] ? `<img src="${tpIcons[item.id]}" alt="" />` : '';
      let wikiLink = item.id ? `<a href="https://wiki.guildwars2.com/wiki/Special:Search/${encodeURIComponent(item.name || '')}" target="_blank" rel="noopener" aria-label="GW2 Wiki for ${item.name}" style="margin-left:0.3em;color:var(--accent);text-decoration:underline;">Wiki</a>` : '';
      let effLink = item.id ? `<a href="https://gw2efficiency.com/item/${item.id}" target="_blank" rel="noopener" aria-label="GW2Efficiency for ${item.name}" style="margin-left:0.3em;color:var(--accent);text-decoration:underline;">Efficiency</a>` : '';
      return `<tr>
        <td class="icon-cell">${icon}${highlight(item.name || '', searchQuery)}${wikiLink}${effLink}</td>
        <td>${item.amount || ''}</td>
        <td>
          ${tp.sell ? formatGW2Currency(tp.sell) : ''}
          ${tp.buy ? `<br><span style="color:#6cf;font-size:0.93em;">Buy: ${formatGW2Currency(tp.buy)}</span>` : ''}
          ${tp.demand ? `<br><span style="color:#e6b800;font-size:0.93em;">Demand: ${tp.demand}</span>` : ''}
        </td>
      </tr>`;
    }).join('');
  } else if (Array.isArray(event.bosses) && event.bosses.length) {
    lootRows = event.bosses.map(boss =>
      `<tr>
        <td>${highlight(boss, searchQuery)}</td>
        <td></td>
        <td></td>
      </tr>`
    ).join('');
  } else {
    lootRows = `<tr><td colspan="3" style="color:#888;">No loot info</td></tr>`;
  }
  const waypoint = event.code ? event.code : '';
  let lootNames = (event.loot || []).map(item => item.name).join(', ');
  let sellValueStr = maxSellValue ? ` (${formatGW2Currency(maxSellValue)})` : '';
  const copyValue = `${event.name || 'Unnamed Event'} | ${waypoint} | ${lootNames}${sellValueStr}`;
  return `
    <div class="event-card" tabindex="0" aria-label="${event.name || 'Unnamed Event'}" data-idx="${idx}">
      <div class="copy-bar">
        <input id="copy-input-${idx}" type="text" value="${copyValue.replace(/"/g, '&quot;')}" readonly>
        <button id="copy-btn-${idx}" aria-label="Copy">Copy</button>
        <span class="copy-msg" id="copy-msg-${idx}">Copied!</span>
      </div>
      <div class="event-header" tabindex="0" aria-label="Show details for ${event.name || 'Unnamed Event'}" data-idx="${idx}">
        <span class="event-title">${highlight(event.name || 'Unnamed Event', searchQuery)}</span>
        <span class="event-location">${highlight(event.map || event.location || 'Unknown location', searchQuery)}</span>
        <button class="drops-toggle" aria-controls="loot-${idx}" aria-expanded="false">Show Loot ▼</button>
      </div>
      <div class="loot-list" id="loot-${idx}">
        <table class="loot-table">
          <thead>
            <tr><th>Item</th><th>Amount</th><th>Sell Value</th></tr>
          </thead>
          <tbody>
            ${lootRows}
          </tbody>
        </table>
        <div class="event-notes"><strong>Notes:</strong> ${event.notes || ''}</div>
      </div>
    </div>
  `;
}

// *** UPDATED: Use the correct container ID ***
window.renderAllSections = async function(events, searchQuery, sortBy) {
  const allSectionsDiv = document.getElementById('events-container');
  if (!allSectionsDiv) {
    console.error("Container #events-container not found!");
    return;
  }
  allSectionsDiv.innerHTML = `<div class="spinner"></div>`;
  const filtered = events.filter(ev => eventMatchesSearch(ev, searchQuery));
  if (!filtered.length) {
    allSectionsDiv.innerHTML = `<div class="empty-state"><img src="https://i.imgur.com/8z8Q2Hk.png" alt="No events"><div>No events found. Try a different search or reload data.</div></div>`;
    return;
  }
  const expansions = groupEvents(filtered);
  let allItemIds = [];
  filtered.forEach(event => {
    if (Array.isArray(event.loot)) {
      event.loot.forEach(item => { if (item.id) allItemIds.push(item.id); });
    }
  });
  allItemIds = [...new Set(allItemIds)];
  const { prices: tpPrices, icons: tpIcons } = await fetchTPPricesAndIcons(allItemIds);
  let html = '';
  let expIdx = 0;
  for (const [expansion, sources] of Object.entries(expansions)) {
    html += `<section id="expansion-${expIdx}" data-expanded="true" style="margin-bottom:3em;">`;
    html += `<button class="section-title" aria-expanded="true" id="expansion-${expIdx}-title">${expansion} <span class="arrow">&#9660;</span></button>`;
    let srcIdx = 0;
    for (const [sourceName, evs] of Object.entries(sources)) {
      html += `
        <button class="source-title" id="expansion-${expIdx}-source-${srcIdx}-title" aria-expanded="true">
          ${sourceName} <span class="arrow">&#9660;</span>
        </button>
        <div id="expansion-${expIdx}-source-${srcIdx}" class="event-list">
          ${evs.map((event, idx) => {
            let maxSell = 0;
            if (Array.isArray(event.loot)) {
              event.loot.forEach(item => {
                const sell = (item.id && tpPrices[item.id] && tpPrices[item.id].sell) || 0;
                if (sell > maxSell) maxSell = sell;
              });
            }
            return renderEventCard(event, `${expIdx}-${srcIdx}-${idx}`, searchQuery, tpPrices, tpIcons, maxSell);
          }).join('')}
        </div>
      `;
      srcIdx++;
    }
    html += `</section>`;
    expIdx++;
  }
  allSectionsDiv.innerHTML = html;
  // (Collapse/expand and copy logic omitted for brevity, but should be included as in your original)
};

window.cmd_run = function(cmdString) {
  let match = cmdString.match(/^show expansion "(.+)" source "(.+)"$/i);
  if (match) {
    const [_, exp, src] = match;
    window.renderAllSections(
      window.allEvents.filter(ev => ev.expansion === exp && ev._sourceName === src),
      window.currentSearch,
      window.currentSort
    );
    return;
  }
  match = cmdString.match(/^show expansion "(.+)"$/i);
  if (match) {
    const [_, exp] = match;
    window.renderAllSections(
      window.allEvents.filter(ev => ev.expansion === exp),
      window.currentSearch,
      window.currentSort
    );
    return;
  }
  match = cmdString.match(/^show source "(.+)"$/i);
  if (match) {
    const [_, src] = match;
    window.renderAllSections(
      window.allEvents.filter(ev => ev._sourceName === src),
      window.currentSearch,
      window.currentSort
    );
    return;
  }
  match = cmdString.match(/^show all$/i);
  if (match) {
    window.renderAllSections(window.allEvents, window.currentSearch, window.currentSort);
    return;
  }
  alert("Onbekend commando: " + cmdString);
};

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('searchInput').addEventListener('input', function() {
    window.currentSearch = this.value.trim();
    document.getElementById('searchClearBtn').style.display = window.currentSearch ? '' : 'none';
    window.renderAllSections(window.allEvents, window.currentSearch, window.currentSort);
  });
  document.getElementById('searchClearBtn').addEventListener('click', function() {
    document.getElementById('searchInput').value = '';
    window.currentSearch = '';
    this.style.display = 'none';
    window.renderAllSections(window.allEvents, window.currentSearch, window.currentSort);
  });
  document.getElementById('sortSelect').addEventListener('change', function() {
    window.currentSort = this.value;
    window.renderAllSections(window.allEvents, window.currentSearch, window.currentSort);
  });
  document.getElementById('closeModalBtn').onclick = function() {
    document.getElementById('eventModal').style.display = 'none';
    document.getElementById('modalContent').innerHTML = '';
  };
});

(async function loadAndRenderAll() {
  window.allEvents = await fetchAllEvents();
  window.renderAllSections(window.allEvents, window.currentSearch, window.currentSort);
})();
