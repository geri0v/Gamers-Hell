class GhEventsLoot extends HTMLElement {
  static get observedAttributes() { return ['theme']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Insert HTML and CSS into the Shadow DOM
    this.shadowRoot.innerHTML = `
      <style>
        :host([theme="darkglossy"]) {
          --card-bg: linear-gradient(135deg, rgba(24,28,38,0.98) 80%, rgba(60,110,141,0.13) 100%);
          --accent: #ffcc00;
          --fg: #fff;
          --loot-table-header-bg: rgba(60,110,141,0.15);
          --loot-table-border: 1px solid rgba(43,71,101,0.18);
          --loot-muted: #aaa;
          --glass-blur: blur(10px) saturate(1.4);
        }
        :host([theme="whiteglass"]) {
          --card-bg: linear-gradient(120deg, rgba(255,255,255,0.95) 80%, rgba(43,71,101,0.07) 100%);
          --accent: #2b4765;
          --fg: #222;
          --loot-table-header-bg: #e0e8f6;
          --loot-table-border: 1px solid #dde6f2;
          --loot-muted: #607080;
          --glass-blur: blur(8px) saturate(1.2);
        }
        :host {
          --card-bg: linear-gradient(135deg, rgba(24,28,38,0.98) 80%, rgba(60,110,141,0.13) 100%);
          --accent: #ffcc00;
          --fg: #fff;
          --loot-table-header-bg: rgba(60,110,141,0.15);
          --loot-table-border: 1px solid rgba(43,71,101,0.18);
          --loot-muted: #aaa;
          --glass-blur: blur(10px) saturate(1.4);
        }
        .loot-panel {
          max-width: 820px;
          margin: 2em auto 0 auto;
        }
        .search-bar-container {
          display: flex;
          gap: 0.7em;
          align-items: center;
          margin-bottom: 1.5em;
          background: rgba(0,0,0,0.06);
          border-radius: 8px;
          padding: 0.7em 1em;
        }
        .search-input {
          flex: 1;
          padding: 0.6em 1em;
          border-radius: 7px;
          border: 1px solid #bbb;
          font-size: 1.05em;
          background: #fff;
          color: #222;
        }
        .search-clear-btn {
          background: var(--accent);
          color: #222;
          border: none;
          border-radius: 5px;
          font-size: 1.2em;
          padding: 0.2em 0.7em;
          cursor: pointer;
        }
        .search-clear-btn:focus {
          outline: 2px solid var(--accent);
        }
        select {
          border-radius: 7px;
          border: 1px solid #bbb;
          font-size: 1.05em;
          padding: 0.6em 1em;
        }
        .section-title, .source-title {
          background: none;
          border: none;
          color: var(--accent);
          font-size: 1.15em;
          font-weight: bold;
          margin: 1.2em 0 0.2em 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5em;
          transition: color 0.2s;
        }
        .section-title.collapsed .arrow,
        .source-title.collapsed .arrow {
          transform: rotate(-90deg);
        }
        .arrow {
          display: inline-block;
          transition: transform 0.2s;
        }
        .event-list {
          margin-bottom: 1em;
        }
        .event-card {
          background: var(--card-bg);
          color: var(--fg);
          border-radius: 16px;
          box-shadow: 0 8px 40px #0007, 0 1.5px 4px #0003;
          padding: 2em 1.5em;
          margin-bottom: 2em;
          backdrop-filter: var(--glass-blur);
          border: 1.5px solid rgba(43,71,101,0.13);
          transition: background 0.3s, color 0.3s;
          position: relative;
          animation: fadeIn .5s cubic-bezier(.4,2,.6,1);
        }
        .event-card:focus-within, .event-card:hover {
          box-shadow: 0 12px 48px #0009;
          outline: 2px solid var(--accent);
        }
        .event-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1em;
          margin-bottom: .7em;
        }
        .event-title {
          font-size: 1.18em;
          font-weight: bold;
          color: var(--accent);
        }
        .event-location {
          font-size: 1.03em;
          color: #e6b800;
          margin-left: 0.7em;
        }
        .copy-bar {
          display: flex;
          align-items: center;
          gap: .5em;
          margin-bottom: .6em;
        }
        .copy-bar input {
          flex: 1;
          border-radius: 5px;
          border: 1px solid #444;
          background: #222;
          color: #fff;
          font-size: 1em;
          padding: 0.2em 0.6em;
        }
        .copy-bar button {
          background: var(--accent);
          color: #222;
          border: none;
          border-radius: 5px;
          padding: 0.3em 1.1em;
          font-size: 1em;
          cursor: pointer;
          transition: background 0.2s;
        }
        .copy-bar button.copied {
          background: #2ecc40;
          color: #fff;
        }
        .copy-msg {
          display: none;
          margin-left: 0.4em;
          color: #2ecc40;
          font-weight: bold;
          font-size: 1em;
        }
        .drops-toggle {
          background: var(--accent);
          color: #222;
          border: none;
          border-radius: 5px;
          padding: 0.3em 1.1em;
          font-size: 1em;
          cursor: pointer;
          box-shadow: 0 2px 8px #0002;
          transition: background 0.2s, color 0.2s;
        }
        .drops-toggle[aria-expanded="true"] {
          background: #222;
          color: var(--accent);
        }
        .loot-list { display: none; }
        .loot-list.active { display: block; animation: fadeIn 0.4s; }
        .loot-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-bottom: 1em;
          background: none;
        }
        .loot-table th, .loot-table td {
          padding: 0.7em 0.8em;
          text-align: left;
          font-size: 1em;
        }
        .loot-table th {
          background: var(--loot-table-header-bg);
          color: var(--accent);
          font-weight: 700;
          border-bottom: var(--loot-table-border);
        }
        .loot-table td {
          border-bottom: var(--loot-table-border);
          color: var(--fg);
        }
        .icon-cell img {
          width: 28px; height: 28px; vertical-align: middle; margin-right: 0.5em; border-radius: 4px;
          box-shadow: 0 2px 6px #0004;
        }
        .loot-table .muted {
          color: var(--loot-muted);
          font-size: 0.96em;
        }
        .loot-table a {
          color: var(--accent);
          text-decoration: underline dotted;
          margin-left: 0.3em;
          font-size: 0.98em;
        }
        .loot-table a:hover {
          color: #e84118;
        }
        .event-notes {
          color: #aaa;
          font-size: 0.97em;
          margin-top: 0.6em;
          background: rgba(255,255,255,0.03);
          border-radius: 6px;
          padding: 0.5em 0.8em;
        }
        .empty-state {
          text-align: center;
          color: #aaa;
          margin: 3em 0;
        }
        .empty-state img {
          width: 120px;
          opacity: 0.7;
        }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(24px);}
          to   { opacity:1; transform:none;}
        }
        @media (max-width: 700px) {
          .loot-panel {
            padding: 1em 0.5em;
            font-size: 1em;
          }
          .event-card {
            padding: 0.7em 0.3em 1em 0.3em;
            font-size: 1em;
          }
          .loot-table th, .loot-table td {
            padding: 0.45em 0.3em;
          }
        }
      </style>
      <div class="loot-panel">
        <div class="search-bar-container" role="search">
          <input aria-label="Search" class="search-input" id="searchInput" placeholder="Search temples, bosses, loot..." type="text"/>
          <button class="search-clear-btn" id="searchClearBtn" aria-label="Clear search" title="Clear search" tabindex="0" style="display:none;">×</button>
          <select id="sortSelect" aria-label="Sort events">
            <option value="name">Sort: Name</option>
            <option value="location">Sort: Location</option>
            <option value="loot">Sort: Loot Value</option>
          </select>
        </div>
        <div aria-live="polite" aria-relevant="additions" id="mainContent" tabindex="0">
          <div id="allSections"></div>
        </div>
      </div>
    `;

    // State
    this.jsonSources = [
      {
        name: "Temples of Orr",
        url: "https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json"
      },
      {
        name: "Valuable Events",
        url: "https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json"
      }
    ];
    this.allEvents = [];
    this.currentSearch = '';
    this.currentSort = 'name';
  }

  connectedCallback() {
    const sr = this.shadowRoot;
    sr.getElementById('searchInput').addEventListener('input', () => {
      this.currentSearch = sr.getElementById('searchInput').value.trim();
      sr.getElementById('searchClearBtn').style.display = this.currentSearch ? '' : 'none';
      this.renderAllSections();
    });
    sr.getElementById('searchClearBtn').addEventListener('click', () => {
      sr.getElementById('searchInput').value = '';
      this.currentSearch = '';
      sr.getElementById('searchClearBtn').style.display = 'none';
      this.renderAllSections();
    });
    sr.getElementById('sortSelect').addEventListener('change', () => {
      this.currentSort = sr.getElementById('sortSelect').value;
      this.renderAllSections();
    });

    this.fetchAllEvents().then(events => {
      this.allEvents = events;
      this.renderAllSections();
    });
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'theme') {
      this.renderAllSections(); // Re-render to apply theme
    }
  }

  async fetchAllEvents() {
    const all = await Promise.all(this.jsonSources.map(async (src) => {
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

  groupEvents(events) {
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

  async fetchTPPricesAndIcons(itemIds) {
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

  formatGW2Currency(price) {
    if (!price) return '';
    const gold = Math.floor(price / 10000);
    const silver = Math.floor((price % 10000) / 100);
    const copper = price % 100;
    return `${gold}g ${silver}s ${copper}c`;
  }

  eventMatchesSearch(event, query) {
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

  highlight(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  renderEventCard(event, idx, searchQuery, tpPrices, tpIcons, maxSellValue) {
    let lootRows = '';
    if (Array.isArray(event.loot) && event.loot.length) {
      lootRows = event.loot.map(item => {
        let tp = tpPrices[item.id] || {};
        let icon = tpIcons[item.id] ? `<img src="${tpIcons[item.id]}" alt="" />` : '';
        let wikiLink = item.id ? `<a href="https://wiki.guildwars2.com/wiki/Special:Search/${encodeURIComponent(item.name || '')}" target="_blank" rel="noopener" aria-label="GW2 Wiki for ${item.name}" style="margin-left:0.3em;">Wiki</a>` : '';
        let effLink = item.id ? `<a href="https://gw2efficiency.com/item/${item.id}" target="_blank" rel="noopener" aria-label="GW2Efficiency for ${item.name}" style="margin-left:0.3em;">Efficiency</a>` : '';
        return `<tr>
          <td class="icon-cell">${icon}${this.highlight(item.name || '', searchQuery)}${wikiLink}${effLink}</td>
          <td>${item.amount || ''}</td>
          <td>
            ${tp.sell ? this.formatGW2Currency(tp.sell) : ''}
            ${tp.buy ? `<br><span style="color:#6cf;font-size:0.93em;">Buy: ${this.formatGW2Currency(tp.buy)}</span>` : ''}
            ${tp.demand ? `<br><span style="color:#e6b800;font-size:0.93em;">Demand: ${tp.demand}</span>` : ''}
          </td>
        </tr>`;
      }).join('');
    } else if (Array.isArray(event.bosses) && event.bosses.length) {
      lootRows = event.bosses.map(boss =>
        `<tr>
          <td>${this.highlight(boss, searchQuery)}</td>
          <td></td>
          <td></td>
        </tr>`
      ).join('');
    } else {
      lootRows = `<tr><td colspan="3" style="color:#888;">No loot info</td></tr>`;
    }
    const waypoint = event.code ? event.code : '';
    let lootNames = (event.loot || []).map(item => item.name).join(', ');
    let sellValueStr = maxSellValue ? ` (${this.formatGW2Currency(maxSellValue)})` : '';
    const copyValue = `${event.name || 'Unnamed Event'} | ${waypoint} | ${lootNames}${sellValueStr}`;
    return `
      <div class="event-card" tabindex="0" aria-label="${event.name || 'Unnamed Event'}" data-idx="${idx}">
        <div class="copy-bar">
          <input id="copy-input-${idx}" type="text" value="${copyValue.replace(/"/g, '&quot;')}" readonly>
          <button id="copy-btn-${idx}" aria-label="Copy">Copy</button>
          <span class="copy-msg" id="copy-msg-${idx}">Copied!</span>
        </div>
        <div class="event-header" tabindex="0" aria-label="Show details for ${event.name || 'Unnamed Event'}" data-idx="${idx}">
          <span class="event-title">${this.highlight(event.name || 'Unnamed Event', searchQuery)}</span>
          <span class="event-location">${this.highlight(event.map || event.location || 'Unknown location', searchQuery)}</span>
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

  async renderAllSections() {
    const sr = this.shadowRoot;
    const allSectionsDiv = sr.getElementById('allSections');
    // Filter
    let filtered = this.allEvents.filter(ev => this.eventMatchesSearch(ev, this.currentSearch));
    // Sort
    if (this.currentSort === 'name') {
      filtered = filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (this.currentSort === 'location') {
      filtered = filtered.sort((a, b) => (a.map || a.location || '').localeCompare(b.map || b.location || ''));
    } else if (this.currentSort === 'loot') {
      filtered = filtered.sort((a, b) => {
        const getMaxSell = ev => Math.max(...(ev.loot || []).map(item => item.sell || 0), 0);
        return getMaxSell(b) - getMaxSell(a);
      });
    }
    if (!filtered.length) {
      allSectionsDiv.innerHTML = `<div class="empty-state"><img src="https://i.imgur.com/8z8Q2Hk.png" alt="No events"><div>No events found. Try a different search or reload data.</div></div>`;
      return;
    }
    // Group
    const expansions = this.groupEvents(filtered);
    let allItemIds = [];
    filtered.forEach(event => {
      if (Array.isArray(event.loot)) {
        event.loot.forEach(item => { if (item.id) allItemIds.push(item.id); });
      }
    });
    allItemIds = [...new Set(allItemIds)];
    const { prices: tpPrices, icons: tpIcons } = await this.fetchTPPricesAndIcons(allItemIds);
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
              return this.renderEventCard(event, `${expIdx}-${srcIdx}-${idx}`, this.currentSearch, tpPrices, tpIcons, maxSell);
            }).join('')}
          </div>
        `;
        srcIdx++;
      }
      html += `</section>`;
      expIdx++;
    }
    allSectionsDiv.innerHTML = html;

    // Add expand/collapse logic and copy/toggle handlers
    expIdx = 0;
    for (const [expansion, sources] of Object.entries(expansions)) {
      const section = sr.getElementById(`expansion-${expIdx}`);
      const btn = sr.getElementById(`expansion-${expIdx}-title`);
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
        const srcBtn = sr.getElementById(`expansion-${expIdx}-source-${srcIdx}-title`);
        const srcList = sr.getElementById(`expansion-${expIdx}-source-${srcIdx}`);
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
          const copyBtn = sr.getElementById(`copy-btn-${id}`);
          const copyInput = sr.getElementById(`copy-input-${id}`);
          const copyMsg = sr.getElementById(`copy-msg-${id}`);
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
          const toggleBtn = sr.querySelector(`.event-card[data-idx="${id}"] .drops-toggle`);
          const lootList = sr.getElementById(`loot-${id}`);
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
  }
}

customElements.define('gh-events-loot', GhEventsLoot);
