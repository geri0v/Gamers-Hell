// == Gamers-Hell: render.js ==

window.showToast = function(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 4000);
};

window.splitCoins = function(coins) {
  if (typeof coins !== 'number' || isNaN(coins)) return '';
  const gold = Math.floor(coins / 10000);
  const silver = Math.floor((coins % 10000) / 100);
  const copper = coins % 100;
  let str = '';
  if (gold) str += `<span class="gold">${gold}g</span> `;
  if (gold || silver) str += `<span class="silver">${silver}s</span> `;
  str += `<span class="copper">${copper}c</span>`;
  return str.trim();
};

window.showCopyNudge = function(btn) {
  const parent = btn.parentElement;
  const existing = parent.querySelector('.copy-nudge');
  if (existing) existing.remove();
  let nudge = document.createElement('span');
  nudge.className = 'copy-nudge';
  nudge.textContent = 'Copied!';
  parent.appendChild(nudge);
  setTimeout(() => nudge.remove(), 1200);
};

window.renderEvents = async function(events, container) {
  if (!container) return;
  container.innerHTML = '';
  if (!events.length) {
    container.innerHTML = `<div class="empty-state">No events found. Check your JSON URLs and structure.</div>`;
    return;
  }

  // Group events by expansion and sourceName
  const expansions = {};
  events.forEach(ev => {
    const exp = ev?.expansion || 'Unknown Expansion';
    const src = ev?.sourceName || 'Unknown Source';
    if (!expansions[exp]) expansions[exp] = {};
    if (!expansions[exp][src]) expansions[exp][src] = [];
    expansions[exp][src].push(ev);
  });

  // Render each expansion and its sources
  Object.entries(expansions).forEach(([expansion, sources]) => {
    const expSection = document.createElement('section');
    expSection.className = 'expansion-section';
    expSection.innerHTML = `
      <button class="section-title" aria-expanded="true">${expansion} ▲</button>
      <div class="sources-container" style="display:block;"></div>
    `;
    const sourcesContainer = expSection.querySelector('.sources-container');

    Object.entries(sources).forEach(([source, events]) => {
      const srcDiv = document.createElement('div');
      srcDiv.className = 'source-section';
      srcDiv.innerHTML = `
        <button class="source-title" aria-expanded="true">${source} ▲</button>
        <div class="events-container" style="display:block;"></div>
      `;
      const eventsContainer = srcDiv.querySelector('.events-container');

      // Render each event card
      for (const ev of events) {
        let enrichedLoot = [];
        if (Array.isArray(ev.loot)) {
          enrichedLoot = await Promise.all(ev.loot.map(async item => {
            try {
              const info = await window.getItemFullInfo(item.id || item.code || item.name);
              return { ...item, ...info };
            } catch (e) {
              console.error('Failed to enrich loot', item, e);
              return item;
            }
          }));
        }
        // Find most valuable loot
        let mostValuable = null;
        let maxValue = -1;
        for (const item of enrichedLoot) {
          const value = item.tp_value ?? item.vendor_value ?? 0;
          if (value > maxValue) {
            maxValue = value;
            mostValuable = item;
          }
        }
        // Prepare copy-paste value with loot values and most valuable
        let mostValuableStr = '';
        if (mostValuable) {
          let value = '';
          if (typeof mostValuable.tp_value === 'number') value = window.splitCoins(mostValuable.tp_value);
          else if (typeof mostValuable.vendor_value === 'number') value = window.splitCoins(mostValuable.vendor_value);
          mostValuableStr = ` | Most Valuable: ${mostValuable.name}${value ? ' (' + value + ')' : ''}`;
        }
        const copyValue = `${ev.name || ''} | ${ev.code || ''} | ${
          (enrichedLoot || []).map(item => {
            let value = '';
            if (typeof item.tp_value === 'number') value = window.splitCoins(item.tp_value);
            else if (typeof item.vendor_value === 'number') value = window.splitCoins(item.vendor_value);
            return `${item.name}${value ? ' (' + value + ')' : ''}`;
          }).join(', ')
        }${mostValuableStr}`;

        // Render loot rows
        const lootRows = enrichedLoot.map(item => {
          let icon = item.icon ? `<img src="${item.icon}" alt="" class="loot-icon" />` : '';
          let wikiLink = item.name ? `<a href="https://wiki.guildwars2.com/wiki/${encodeURIComponent(item.name.replace(/ /g, '_'))}" target="_blank" rel="noopener" style="margin-left:0.3em;color:var(--color-accent-emerald);text-decoration:underline;">Wiki</a>` : '';
          let sellValue = (typeof item.tp_value === 'number') ? `<span class="tp-value">${window.splitCoins(item.tp_value)}</span>` : '';
          let vendorValue = (typeof item.vendor_value === 'number') ? `<span class="vendor-value">${window.splitCoins(item.vendor_value)}</span>` : '';
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

        // Build the event card
        const card = document.createElement('div');
        card.className = 'event-card fullwidth-event-card';
        card.innerHTML = `
          <div class="card-header">
            <h2 class="event-name">
              <a href="https://wiki.guildwars2.com/wiki/${encodeURIComponent((ev.name||'').replace(/ /g, '_'))}" target="_blank" rel="noopener">${ev.name || 'Unnamed Event'}</a>
            </h2>
          </div>
          <div class="card-body">
            <div class="event-info">
              <span><b>Location:</b> ${
                ev.map
                  ? `<a href="https://wiki.guildwars2.com/wiki/${encodeURIComponent(ev.map.replace(/ /g, '_'))}" target="_blank" rel="noopener">${ev.map}</a>`
                  : ''
              }</span>
              <span><b>Waypoint:</b> ${ev.code ? `<code>${ev.code}</code>` : ''}</span>
            </div>
            <div class="event-loot-summary">
              <b>Best Loot:</b> ${mostValuable ? `<a href="https://wiki.guildwars2.com/wiki/${encodeURIComponent(mostValuable.name.replace(/ /g, '_'))}" target="_blank">${mostValuable.name}</a> ${typeof mostValuable.tp_value === 'number' ? `<span class="tp-value">${window.splitCoins(mostValuable.tp_value)}</span>` : typeof mostValuable.vendor_value === 'number' ? `<span class="vendor-value">${window.splitCoins(mostValuable.vendor_value)}</span>` : ''}` : 'N/A'}
            </div>
            <div class="copy-bar">
              <input type="text" value="${copyValue}" readonly>
              <button class="copy-btn" type="button">Copy</button>
            </div>
            <button class="show-hide-toggle" type="button" aria-controls="loot-${ev.name}" aria-expanded="false">Show Loot ▼</button>
            <ul class="loot-list copy-paste-area" id="loot-${ev.name}" style="display:none;">
              ${lootRows}
            </ul>
          </div>
        `;
        // Copy button logic
        card.querySelector('.copy-btn').onclick = function() {
          const input = card.querySelector('.copy-bar input');
          navigator.clipboard.writeText(input.value);
          window.showCopyNudge(this);
        };
        // Loot show/hide toggle
        const lootBtn = card.querySelector('.show-hide-toggle');
        const lootList = card.querySelector('.loot-list');
        lootBtn.onclick = function() {
          const isOpen = lootList.style.display === 'block';
          lootList.style.display = isOpen ? 'none' : 'block';
          lootBtn.textContent = isOpen ? 'Show Loot ▼' : 'Hide Loot ▲';
          lootBtn.setAttribute('aria-expanded', !isOpen);
        };
        eventsContainer.appendChild(card);
      }
      sourcesContainer.appendChild(srcDiv);
    });

    // Expand/collapse for expansion sections
    expSection.querySelector('.section-title').addEventListener('click', function() {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !expanded);
      this.textContent = expanded ? `${expansion} ▼` : `${expansion} ▲`;
      expSection.querySelector('.sources-container').style.display = expanded ? 'none' : 'block';
    });
    container.appendChild(expSection);
  });
};
