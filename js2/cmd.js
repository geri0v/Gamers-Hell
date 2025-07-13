// == Gamers-Hell: Full JS App for Modern Layout & Menu Integration ==

const DATA_URLS = [
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
];

let allEvents = [];
let filteredEvents = [];
let sortKey = 'name';
let sortAsc = true;

function groupEvents(events) {
  const expansions = {};
  events.forEach(ev => {
    const exp = ev.expansion || 'Unknown Expansion';
    const src = ev.sourceName || ev._sourceName || 'Unknown Source';
    if (!expansions[exp]) expansions[exp] = {};
    if (!expansions[exp][src]) expansions[exp][src] = [];
    expansions[exp][src].push(ev);
  });
  return expansions;
}

function getMenuStructure() {
  const structure = {};
  allEvents.forEach(ev => {
    const exp = ev.expansion || 'Unknown Expansion';
    const src = ev.sourceName || ev._sourceName || 'Unknown Source';
    if (!structure[exp]) structure[exp] = new Set();
    structure[exp].add(src);
  });
  Object.keys(structure).forEach(k => structure[k] = Array.from(structure[k]));
  return structure;
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

function renderEvents() {
  const container = document.getElementById('events');
  container.innerHTML = '';
  if (!filteredEvents.length) {
    container.innerHTML = `<div class="empty-state">No events found.</div>`;
    return;
  }
  const groups = groupEvents(filteredEvents);
  Object.entries(groups).forEach(([expansion, sources]) => {
    Object.entries(sources).forEach(([source, events]) => {
      events.forEach((ev, idx) => {
        const lootListId = `loot-list-${expansion.replace(/\s/g,'_')}-${source.replace(/\s/g,'_')}-${idx}`;
        const lootNames = (ev.loot || []).map(item => item.name).join(', ');
        const copyValue = `${ev.name || 'Unnamed Event'} | ${ev.code || ''} | ${lootNames}`;
        let lootRows = '';
        if (Array.isArray(ev.loot) && ev.loot.length) {
          lootRows = ev.loot.map(item => {
            let icon = item.icon ? `<img src="${item.icon}" alt="" class="loot-icon" />` : '';
            let value = item.value ? `<span class="tp-value">${item.value}</span>` : '';
            return `<li>${icon}${item.name || ''}${value}</li>`;
          }).join('');
        } else {
          lootRows = `<li style="color:#888;">No loot info</li>`;
        }
        const card = document.createElement('div');
        card.className = 'event-card fullwidth-event-card';
        card.innerHTML = `
          <div class="card-header">
            <h2 class="event-name">${ev.name || 'Unnamed Event'}</h2>
          </div>
          <div class="card-body">
            <div class="event-info">
              <span><b>Location:</b> ${ev.map || ''}</span>
              <span><b>Waypoint:</b> ${ev.code ? `<code>${ev.code}</code>` : ''}</span>
            </div>
            <div class="copy-bar">
              <input type="text" value="${copyValue}" readonly>
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
        container.appendChild(card);
      });
    });
  });
}

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

window.cmd_run = function(cmdString) {
  let match = cmdString.match(/^show expansion "(.+)" source "(.+)"$/i);
  if (match) {
    const [_, exp, src] = match;
    filteredEvents = allEvents.filter(ev => (ev.expansion || 'Unknown Expansion') === exp && (ev.sourceName || ev._sourceName || 'Unknown Source') === src);
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
    filteredEvents = allEvents.filter(ev => (ev.sourceName || ev._sourceName || 'Unknown Source') === src);
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

document.addEventListener('DOMContentLoaded', async function() {
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
      return events;
    } catch (e) {
      return [];
    }
  }));
  allEvents = all.flat();
  filteredEvents = allEvents;
  renderEvents();
  if (window.renderMenu) window.renderMenu(getMenuStructure());
  document.getElementById('search').addEventListener('input', applyFilters);
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
  // Expose render for menu.js fallback (optional)
  window.render = renderEvents;
});
