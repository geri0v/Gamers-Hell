// Configuration
const DATA_URLS = [
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
  'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
];

// State
let allEvents = [];
let filteredEvents = [];
let sortKey = 'name';
let sortAsc = true;

// Fetch and process data
async function loadData() {
  const allData = await Promise.all(DATA_URLS.map(url => fetch(url).then(r => r.json())));
  let events = [];
  allData.forEach(data => {
    if (Array.isArray(data)) {
      data.forEach(group => {
        group.events.forEach(event => {
          events.push({
            ...event,
            sourceName: group.sourceName
          });
        });
      });
    } else {
      Object.values(data).forEach(group => {
        group.events.forEach(event => {
          events.push({
            ...event,
            sourceName: group.sourceName
          });
        });
      });
    }
  });
  allEvents = events;
  filteredEvents = events;
  render();
}

// Group by expansion and sourcename
function groupEvents(events) {
  const expansions = {};
  events.forEach(ev => {
    if (!expansions[ev.expansion]) expansions[ev.expansion] = {};
    if (!expansions[ev.expansion][ev.sourceName]) expansions[ev.expansion][ev.sourceName] = [];
    expansions[ev.expansion][ev.sourceName].push(ev);
  });
  return expansions;
}

// Search and sort
function applyFilters() {
  let query = document.getElementById('search').value.toLowerCase();
  filteredEvents = allEvents.filter(ev =>
    ev.name.toLowerCase().includes(query) ||
    ev.map.toLowerCase().includes(query) ||
    (ev.loot && ev.loot.some(item => item.name.toLowerCase().includes(query)))
  );
  filteredEvents.sort((a, b) => {
    let vA = a[sortKey] || '';
    let vB = b[sortKey] || '';
    if (typeof vA === 'string') vA = vA.toLowerCase();
    if (typeof vB === 'string') vB = vB.toLowerCase();
    if (vA < vB) return sortAsc ? -1 : 1;
    if (vA > vB) return sortAsc ? 1 : -1;
    return 0;
  });
  render();
}

// Helper to create wiki URL
function createWikiUrl(name) {
  return `https://wiki.guildwars2.com/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
}

// Render UI
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
        const lootItems = (ev.loot || []).map(item => {
          const itemWikiUrl = createWikiUrl(item.name);
          return `<li><a href="${itemWikiUrl}" target="_blank" rel="noopener noreferrer">${item.name}</a>${item.price ? ' - ' + item.price + 'g' : ''}${item.code ? ` <code>${item.code}</code>` : ''}</li>`;
        }).join('');
        const lootSection = lootItems
          ? `<div class="loot-section">
              <button class="toggle-loot" onclick="this.nextElementSibling.classList.toggle('show')">Show/Hide Loot</button>
              <ul class="loot-list">${lootItems}</ul>
            </div>`
          : '';
        const firstItem = (ev.loot && ev.loot[0]) ? ev.loot[0].name : '';
        const firstItemValue = (ev.loot && ev.loot[0] && ev.loot[0].price) ? ev.loot[0].price : '';
        const eventWikiUrl = createWikiUrl(ev.name);
        srcDiv.innerHTML += `
          <div class="event">
            <div class="copy-bar">
              <input type="text" value="${ev.name} | ${ev.map} | ${firstItem}${firstItemValue ? ' (' + firstItemValue + 'g)' : ''}" readonly>
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

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  document.getElementById('search').addEventListener('input', applyFilters);
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      sortKey = this.dataset.sort;
      sortAsc = !sortAsc;
      applyFilters();
    });
  });
});
