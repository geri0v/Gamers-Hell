// == Gamers-Hell: Full JS App ==
// Dit script bevat ALLE functionaliteit, styling en integratie met menu.js

(function() {
  // --- 1. Inject Styles ---
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --main-bg: #1e2630;
      --main-fg: #f3f7fa;
      --card-bg: #263142;
      --header-bg: #232c3b;
      --footer-bg: #232c3b;
      --search-bg: #222a35;
      --input-bg: #2c3746;
      --input-fg: #e1e6ed;
      --copy-bar-bg: #243049;
      --copy-btn-bg: linear-gradient(135deg, #3b4b63 60%, #4a90e2 100%);
      --accent: #4a90e2;
      --table-th: #4a90e2;
      --table-border: #3b4b63;
      --section-title-bg: #232c3b;
      --section-title-fg: #e1e6ed;
      --section-title-hover-bg: #4a90e2;
      --section-title-hover-fg: #fff;
      --spinner-size: 36px;
      --transition: 0.2s cubic-bezier(.4,0,.2,1);
    }
    body {
      background: var(--main-bg);
      color: var(--main-fg);
      font-family: 'Segoe UI', Arial, sans-serif;
      margin: 0;
      transition: background var(--transition), color var(--transition);
    }
    header, footer {
      background: var(--header-bg);
      padding: 1.2em 0;
      text-align: center;
      color: var(--main-fg);
      letter-spacing: 1px;
      font-size: 1.2em;
    }
    .main {
      max-width: 950px;
      margin: 2em auto;
      background: var(--main-bg);
      padding: 2em 1.5em;
      border-radius: 16px;
      box-shadow: 0 4px 24px #0003;
      min-width: 0; position: relative;
    }
    .search-bar-container {
      display: flex; gap: 1em; margin-bottom: 2em;
      background: var(--search-bg); padding: 1em; border-radius: 10px; align-items: center;
      position: sticky; top: 0; z-index: 8;
    }
    .search-input {
      padding: 0.7em; border-radius: 6px; border: none;
      background: var(--input-bg); color: var(--input-fg); font-size: 1.1em; flex: 1; outline: none;
    }
    .search-clear-btn {
      background: none; border: none; font-size: 1.5em; color: var(--accent); cursor: pointer;
      margin-left: -2em; margin-right: 0.5em; padding: 0 0.3em; border-radius: 50%; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
    }
    .copy-bar {
      display: flex; align-items: center; gap: 0.5em;
      background: var(--copy-bar-bg); border-radius: 8px;
      margin-bottom: 1em; padding: 0.7em 1em;
    }
    .copy-bar input {
      flex: 1; padding: 0.4em; border-radius: 4px; border: none;
      background: var(--input-bg); color: var(--input-fg); font-size: 1em; outline: none;
    }
    .copy-bar button {
      padding: 0.4em 1.5em; border-radius: 4px; border: none;
      background: var(--copy-btn-bg); color: var(--copy-btn-color); cursor: pointer;
      transition: background var(--transition), color var(--transition), box-shadow var(--transition), transform var(--transition);
      font-weight: bold; outline: none; min-width: 50px; min-height: 32px; box-shadow: 0 2px 6px #0002; font-size: 1em;
    }
    .copy-bar button.copied { background: #4a90e2 !important; color: #fff !important; transform: scale(1.08); }
    .copy-bar .copy-msg { display:none; color:#6f6; margin-left: 0.5em; }
    .section-title {
      background: var(--section-title-bg); color: var(--section-title-fg);
      padding: 1em 1.2em; border-radius: 12px; font-size: 1.25em; font-weight: bold;
      margin-bottom: 1.5em; cursor: pointer; display: flex; align-items: center; justify-content: center;
      gap: 0.7em; transition: background var(--transition), color var(--transition), box-shadow var(--transition);
      box-shadow: 0 2px 12px #0002; border: none; outline: none; width: 100%; max-width: 480px; margin: 0 auto 1.5em auto;
      user-select: none;
    }
    .section-title .arrow { font-size: 1.1em; transition: transform var(--transition); }
    .section-title.collapsed .arrow { transform: rotate(-90deg); }
    .source-title {
      background: var(--card-bg); color: var(--accent); font-size: 1.1em;
      border: none; border-radius: 8px; margin: 1em auto 0.5em auto; padding: 0.8em 1em;
      display: flex; align-items: center; justify-content: center; max-width: 340px; width: 100%; cursor: pointer;
      transition: background var(--transition), color var(--transition);
    }
    .source-title .arrow { margin-left: 0.7em; }
    .event-list { margin-top: 2em; }
    .event-card {
      background: var(--card-bg); margin-bottom: 2em; padding: 1.5em;
      border-radius: 12px; box-shadow: 0 2px 12px #0004; transition: background var(--transition), box-shadow var(--transition), transform var(--transition);
      outline: none; min-width: 0; cursor: pointer;
    }
    .event-header {
      display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; cursor: pointer;
    }
    .event-title { font-size: 1.2em; font-weight: bold; }
    .event-location { font-size: 0.98em; color: #b3c6e0; margin-left: 1em; }
    .drops-toggle {
      background: none; border: none; color: var(--accent); font-size: 1em; cursor: pointer;
      margin-left: auto; padding: 0.3em 0.7em; border-radius: 4px; min-width: 44px; min-height: 44px;
    }
    .loot-list {
      display: none; margin-top: 1em; background: #222a35; padding: 1em; border-radius: 8px; overflow-x: auto;
    }
    .loot-list.active { display: block; }
    .loot-table {
      width: 100%; border-collapse: collapse; margin-top: 0.5em; min-width: 400px;
    }
    .loot-table th, .loot-table td { padding: 0.4em 0.7em; text-align: left; }
    .loot-table th {
      color: var(--table-th); font-weight: bold; border-bottom: 1px solid var(--table-border); cursor: pointer; user-select: none;
    }
    .loot-table td { border-bottom: 1px solid var(--table-border); }
    .loot-table .icon-cell img {
      width: 22px; height: 22px; vertical-align: middle; margin-right: 6px; border-radius: 3px; background: #111;
    }
    .event-notes { font-size: 0.95em; color: #b3c6e0; margin-top: 0.7em; }
    .spinner {
      display: inline-block; width: var(--spinner-size); height: var(--spinner-size);
      border: 4px solid #4a90e2; border-top: 4px solid #263142; border-radius: 50%;
      animation: spin 1s linear infinite; margin: 2em auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; color: #b3c6e0; margin: 2em 0; font-size: 1.2em; }
    .empty-state img { width: 80px; margin-bottom: 1em; opacity: 0.7; }
    mark { background: #4a90e2; color: #fff; border-radius: 3px; padding: 0 2px; }
  `;
  document.head.appendChild(style);

  // --- 2. Build Page Structure ---
  document.body.innerHTML = '';
  const header = document.createElement('header');
  header.innerHTML = '<h1>Gamers-Hell</h1>';
  document.body.appendChild(header);

  const main = document.createElement('main');
  main.className = 'main';
  main.setAttribute('aria-label', 'Main content area');
  main.setAttribute('id', 'main');
  main.setAttribute('role', 'main');
  main.setAttribute('tabindex', '-1');
  document.body.appendChild(main);

  // Search bar
  const searchBar = document.createElement('div');
  searchBar.className = 'search-bar-container';
  searchBar.setAttribute('role', 'search');
  searchBar.innerHTML = `
    <input aria-label="Search" class="search-input" id="searchInput" placeholder="Search temples, bosses, loot..." type="text"/>
    <button class="search-clear-btn" id="searchClearBtn" aria-label="Clear search" title="Clear search" tabindex="0" style="display:none;">×</button>
    <select id="sortSelect" aria-label="Sort events">
      <option value="name">Sort: Name</option>
      <option value="location">Sort: Location</option>
      <option value="loot">Sort: Loot Value</option>
    </select>
  `;
  main.appendChild(searchBar);

  // --- Menu & Event containers ---
  const menuContainer = document.createElement('div');
  menuContainer.id = 'menu-container';
  main.appendChild(menuContainer);

  const eventsContainer = document.createElement('div');
  eventsContainer.id = 'events-container';
  main.appendChild(eventsContainer);

  // Footer
  const footer = document.createElement('footer');
  footer.innerHTML = '© 2025 Gamers-Hell Community';
  document.body.appendChild(footer);

  // Modal
  const eventModal = document.createElement('div');
  eventModal.id = 'eventModal';
  eventModal.style.display = 'none';
  eventModal.style.position = 'fixed';
  eventModal.style.top = '0';
  eventModal.style.left = '0';
  eventModal.style.width = '100vw';
  eventModal.style.height = '100vh';
  eventModal.style.background = 'rgba(30,38,48,0.95)';
  eventModal.style.zIndex = '1000';
  eventModal.style.alignItems = 'center';
  eventModal.style.justifyContent = 'center';
  eventModal.innerHTML = `
    <div style="background:var(--card-bg);padding:2em;border-radius:10px;max-width:90vw;max-height:90vh;overflow:auto;position:relative;">
      <button id="closeModalBtn" style="position:absolute;top:1em;right:1em;background:#4a90e2;color:#fff;border:none;border-radius:4px;padding:0.4em 1em;cursor:pointer;">Close</button>
      <div id="modalContent"></div>
    </div>
  `;
  document.body.appendChild(eventModal);

  // --- 3. App Logic ---
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

  window.renderAllSections = async function(events, searchQuery, sortBy) {
    const allSectionsDiv = document.getElementById('events-container');
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
    expIdx = 0;
    for (const [expansion, sources] of Object.entries(expansions)) {
      const section = document.getElementById(`expansion-${expIdx}`);
      const btn = document.getElementById(`expansion-${expIdx}-title`);
      const arrow = btn.querySelector('.arrow');
      btn.onclick = function() {
        const visible = section.dataset.expanded !== "false";
        section.dataset.expanded = visible ? "false" : "true";
        btn.classList.toggle('collapsed', visible);
        arrow.innerHTML = visible ? '&#9654;' : '&#9660;';
        Array.from(section.querySelectorAll('.source-title, .event-list')).forEach(el => {
          el.style.display = visible ? 'none' : '';
        });
      };
      let srcIdx = 0;
      for (const sourceName of Object.keys(sources)) {
        const srcBtn = document.getElementById(`expansion-${expIdx}-source-${srcIdx}-title`);
        const srcList = document.getElementById(`expansion-${expIdx}-source-${srcIdx}`);
        const srcArrow = srcBtn.querySelector('.arrow');
        srcBtn.onclick = function() {
          const visible = srcList.style.display !== 'none';
          srcList.style.display = visible ? 'none' : '';
          srcBtn.classList.toggle('collapsed', visible);
          srcArrow.innerHTML = visible ? '&#9654;' : '&#9660;';
        };
        srcIdx++;
      }
      expIdx++;
    }
    expIdx = 0;
    for (const [expansion, sources] of Object.entries(expansions)) {
      let srcIdx = 0;
      for (const sourceName of Object.keys(sources)) {
        const evs = sources[sourceName];
        evs.forEach((event, idx) => {
          const id = `${expIdx}-${srcIdx}-${idx}`;
          const copyBtn = document.getElementById(`copy-btn-${id}`);
          const copyInput = document.getElementById(`copy-input-${id}`);
          const copyMsg = document.getElementById(`copy-msg-${id}`);
          copyBtn.onclick = function() {
            copyInput.select();
            copyInput.setSelectionRange(0, 99999);
            document.execCommand('copy');
            copyMsg.style.display = 'inline';
            copyBtn.classList.add('copied');
            copyBtn.innerText = "✔";
            setTimeout(() => {
              copyMsg.style.display = 'none';
              copyBtn.classList.remove('copied');
              copyBtn.innerText = "Copy";
            }, 1000);
          };
          const toggleBtn = document.querySelector(`.event-card[data-idx="${id}"] .drops-toggle`);
          const lootList = document.getElementById(`loot-${id}`);
          toggleBtn.onclick = (e) => {
            e.stopPropagation();
            lootList.classList.toggle('active');
            const expanded = lootList.classList.contains('active');
            toggleBtn.textContent = expanded ? 'Hide Loot ▲' : 'Show Loot ▼';
            toggleBtn.setAttribute('aria-expanded', expanded);
          };
        });
        srcIdx++;
      }
      expIdx++;
    }
  };

  // --- 4. Command-handler voor menu.js integratie ---
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

  // --- 5. Search, Clear, Sort Handlers ---
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

  // --- 6. Initial Load ---
  (async function loadAndRenderAll() {
    window.allEvents = await fetchAllEvents();
    window.renderAllSections(window.allEvents, window.currentSearch, window.currentSort);
  })();

})();
