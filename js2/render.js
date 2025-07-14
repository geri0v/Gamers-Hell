// == Gamers-Hell: render.js ==

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
  container.innerHTML = '';
  if (!events.length) {
    container.innerHTML = `<div class="empty-state">No events found.</div>`;
    return;
  }
  // Group by expansion/source
  const expansions = {};
  events.forEach(ev => {
    const exp = ev.expansion || 'Unknown Expansion';
    const src = ev.sourceName || 'Unknown Source';
    if (!expansions[exp]) expansions[exp] = {};
    if (!expansions[exp][src]) expansions[exp][src] = [];
    expansions[exp][src].push(ev);
  });

  Object.entries(expansions).forEach(([expansion, sources]) => {
    const expSection = document.createElement('section');
    expSection.className = 'expansion-section';
    expSection.style.display = 'flex';
    expSection.style.flexDirection = 'column';
    expSection.style.alignItems = 'center';
    expSection.innerHTML = `
      <button class="section-title" aria-expanded="false">${expansion} ▼</button>
      <div class="sources-container" style="display:none; width:100%; display:flex; flex-direction:column; align-items:center;"></div>
    `;
    const sourcesContainer = expSection.querySelector('.sources-container');
    Object.entries(sources).forEach(([source, events]) => {
      const srcDiv = document.createElement('div');
      srcDiv.className = 'source-section';
      srcDiv.style.display = 'flex';
      srcDiv.style.flexDirection = 'column';
      srcDiv.style.alignItems = 'center';
      srcDiv.innerHTML = `
        <button class="source-title" aria-expanded="false">${source} ▼</button>
        <div class="events-container" style="display:none; width:100%; display:flex; flex-direction:column; align-items:center;"></div>
      `;
      const eventsContainer = srcDiv.querySelector('.events-container');
      srcDiv.querySelector('.source-title').addEventListener('click', async function() {
        const expanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', !expanded);
        this.textContent = expanded ? `${source} ▼` : `${source} ▲`;
        eventsContainer.style.display = expanded ? 'none' : 'block';
        if (!expanded && !eventsContainer.hasChildNodes()) {
          eventsContainer.innerHTML = '<div class="spinner"></div>';
          for (const ev of events) {
            let enrichedLoot = [];
            if (Array.isArray(ev.loot)) {
              for (const item of ev.loot) {
                const info = await window.getItemFullInfo(item.id || item.code || item.name);
                enrichedLoot.push({ ...item, ...info });
              }
            }
            let mostValuable = null;
            let maxValue = -1;
            for (const item of enrichedLoot) {
              const value = item.tp_value ?? item.vendor_value ?? 0;
              if (value > maxValue) {
                maxValue = value;
                mostValuable = item;
              }
            }
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
            const copyValue = `${ev.name || ''} | ${ev.code || ''} | ${(enrichedLoot || []).map(item => item.name).join(', ')}`;
            const card = document.createElement('div');
            card.className = 'event-card fullwidth-event-card';
            card.style.margin = '0 auto';
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
            card.querySelector('.copy-btn').onclick = function() {
              const input = card.querySelector('.copy-bar input');
              navigator.clipboard.writeText(input.value);
              window.showCopyNudge(this);
            };
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
          if (!events.length) eventsContainer.innerHTML = `<div class="empty-state">No events found.</div>`;
        }
      });
      sourcesContainer.appendChild(srcDiv);
    });
    expSection.querySelector('.section-title').addEventListener('click', function() {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !expanded);
      this.textContent = expanded ? `${expansion} ▼` : `${expansion} ▲`;
      expSection.querySelector('.sources-container').style.display = expanded ? 'none' : 'block';
    });
    container.appendChild(expSection);
  });
};
