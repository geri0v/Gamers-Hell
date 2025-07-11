class GhEventsLoot extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Insert HTML and CSS into the Shadow DOM
    this.shadowRoot.innerHTML = `
      <style>
        /* ...[Paste your entire <style> block here, unchanged]... */
      </style>
      <header>
        <h1>Gamers-Hell</h1>
      </header>
      <main aria-label="Main content area" class="main" id="main" role="main" tabindex="-1">
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
        <footer>
          © 2025 Gamers-Hell Community
        </footer>
        <div id="eventModal" style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(30,38,48,0.95);z-index:1000;align-items:center;justify-content:center;">
          <div style="background:var(--card-bg);padding:2em;border-radius:10px;max-width:90vw;max-height:90vh;overflow:auto;position:relative;">
            <button id="closeModalBtn" style="position:absolute;top:1em;right:1em;background:#4a90e2;color:#fff;border:none;border-radius:4px;padding:0.4em 1em;cursor:pointer;">Close</button>
            <div id="modalContent"></div>
          </div>
        </div>
      </main>
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
    // Event listeners
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
        let wikiLink = item.id ? `<a href="https://wiki.guildwars2.com/wiki/Special:Search/${encodeURIComponent(item.name || '')}" target="_blank" rel="noopener" aria-label="GW2 Wiki for ${item.name}" style="margin-left:0.3em;color:var(--accent);text-decoration:underline;">Wiki</a>` : '';
        let effLink = item.id ? `<a href="https://gw2efficiency.com/item/${item.id}" target="_blank" rel="noopener" aria-label="GW2Efficiency for ${item.name}" style="margin-left:0.3em;color:var(--accent);text-decoration:underline;">Efficiency</a>` : '';
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
    const filtered = this.allEvents.filter(ev => this.eventMatchesSearch(ev, this.currentSearch));
    if (!filtered.length) {
      allSectionsDiv.innerHTML = `<div class="empty-state"><img src="https://i.imgur.com/8z8Q2Hk.png" alt="No events"><div>No events found. Try a different search or reload data.</div></div>`;
      return;
    }
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
