window.showToast = function(msg) {
  const toast = document.getElementById('toast');
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

window.renderEvents = async function(events, container) {
  container.innerHTML = '';
  if (!events.length) {
    container.innerHTML = `<div class="empty-state">${t('No events found.')}</div>`;
    return;
  }
  // Skeleton loader
  for (let i = 0; i < 3; i++) {
    const skel = document.createElement('div');
    skel.className = 'skeleton-card';
    container.appendChild(skel);
  }
  // Simulate loading bar
  const bar = document.createElement('div');
  bar.className = 'retro-loader-bar';
  const barInner = document.createElement('div');
  barInner.className = 'retro-loader-bar-inner';
  barInner.style.width = '0%';
  bar.appendChild(barInner);
  container.appendChild(bar);
  let progress = 0;
  const interval = setInterval(() => {
    progress = Math.min(100, progress + 10);
    barInner.style.width = progress + '%';
    if (progress >= 100) clearInterval(interval);
  }, 100);
  // After loading, render events
  setTimeout(async () => {
    container.innerHTML = '';
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
      expSection.innerHTML = `
        <button class="section-title" aria-expanded="false">${expansion} ▼</button>
        <div class="sources-container" style="display:none;"></div>
      `;
      const sourcesContainer = expSection.querySelector('.sources-container');
      Object.entries(sources).forEach(([source, events]) => {
        const srcDiv = document.createElement('div');
        srcDiv.className = 'source-section';
        srcDiv.innerHTML = `
          <button class="source-title" aria-expanded="false">${source} ▼</button>
          <div class="events-container" style="display:none;"></div>
        `;
        const eventsContainer = srcDiv.querySelector('.events-container');
        srcDiv.querySelector('.source-title').addEventListener('click', async function() {
          const expanded = this.getAttribute('aria-expanded') === 'true';
          this.setAttribute('aria-expanded', !expanded);
          this.textContent = expanded ? `${source} ▼` : `${source} ▲`;
          eventsContainer.style.display = expanded ? 'none' : 'block';
          if (!expanded && !eventsContainer.hasChildNodes()) {
            // Lazy-load loot details, with cache
            eventsContainer.innerHTML = '';
            for (const ev of events) {
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
                    <span><b>${t('Location')}:</b> ${
                      ev.map
                        ? `<a href="https://wiki.guildwars2.com/wiki/${encodeURIComponent(ev.map.replace(/ /g, '_'))}" target="_blank" rel="noopener">${ev.map}</a>`
                        : ''
                    }</span>
                    <span><b>Waypoint:</b> ${ev.code ? `<code>${ev.code}</code>` : ''}</span>
                  </div>
                  <div class="event-loot-summary">${t('Best Loot')}: <span class="loot-loading">${t('Loading...')}</span></div>
                  <div class="copy-bar"></div>
                  <button class="show-hide-toggle" type="button" aria-controls="loot-${ev.name}" aria-expanded="false">${t('Show Loot')} ▼</button>
                  <ul class="loot-list copy-paste-area" id="loot-${ev.name}" style="display:none;"></ul>
                </div>
              `;
              eventsContainer.appendChild(card);
              // Lazy load loot
              const lootSummary = card.querySelector('.event-loot-summary');
              const lootList = card.querySelector('.loot-list');
              if (Array.isArray(ev.loot)) {
                let enrichedLoot = [];
                for (const item of ev.loot) {
                  let info = null;
                  try {
                    const cacheKey = 'iteminfo_' + (item.id || item.code || item.name);
                    if (localStorage.getItem(cacheKey)) {
                      info = JSON.parse(localStorage.getItem(cacheKey));
                    } else {
                      info = await window.getItemFullInfo(item.id || item.code || item.name);
                      localStorage.setItem(cacheKey, JSON.stringify(info));
                    }
                  } catch (e) {
                    window.showToast(`Failed to load item info for ${item.name}`);
                  }
                  enrichedLoot.push({ ...item, ...info });
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
                lootSummary.innerHTML = `<b>${t('Best Loot')}:</b> ${mostValuable ? `<a href="https://wiki.guildwars2.com/wiki/${encodeURIComponent(mostValuable.name.replace(/ /g, '_'))}" target="_blank">${mostValuable.name}</a> ${typeof mostValuable.tp_value === 'number' ? `<span class="tp-value">${window.splitCoins(mostValuable.tp_value)}</span>` : typeof mostValuable.vendor_value === 'number' ? `<span class="vendor-value">${window.splitCoins(mostValuable.vendor_value)}</span>` : ''}` : 'N/A'}`;
                lootList.innerHTML = enrichedLoot.map(item => {
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
              } else {
                lootSummary.innerHTML = `<b>${t('Best Loot')}:</b> N/A`;
              }
              // Copy bar and loot toggle
              const copyValue = `${ev.name || ''} | ${ev.code || ''} | ${(ev.loot || []).map(item => item.name).join(', ')}`;
              const copyBar = card.querySelector('.copy-bar');
              copyBar.innerHTML = `<input type="text" value="${copyValue}" readonly>
                <button class="copy-btn" type="button">${t('Copy')}</button>`;
              copyBar.querySelector('.copy-btn').onclick = function() {
                const input = copyBar.querySelector('input');
                navigator.clipboard.writeText(input.value);
                window.showCopyNudge(this);
              };
              const lootBtn = card.querySelector('.show-hide-toggle');
              lootBtn.onclick = function() {
                const isOpen = lootList.style.display === 'block';
                lootList.style.display = isOpen ? 'none' : 'block';
                lootBtn.textContent = isOpen ? `${t('Show Loot')} ▼` : `${t('Hide Loot')} ▲`;
                lootBtn.setAttribute('aria-expanded', !isOpen);
              };
            }
            if (!events.length) eventsContainer.innerHTML = `<div class="empty-state">${t('No events found.')}</div>`;
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
  }, 1000);
};
