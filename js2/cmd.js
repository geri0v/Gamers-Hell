// == Gamers-Hell: cmd.js ==

let allEvents = [];
let filteredEvents = [];
let sortKey = 'name';
let sortAsc = true;

function getMenuStructure(events) {
  const structure = {};
  events.forEach(ev => {
    const exp = ev.expansion || 'Unknown Expansion';
    const src = ev.sourceName || 'Unknown Source';
    if (!structure[exp]) structure[exp] = new Set();
    structure[exp].add(src);
  });
  Object.keys(structure).forEach(k => structure[k] = Array.from(structure[k]));
  return structure;
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
  window.renderEvents(filteredEvents, document.getElementById('events'));
}

window.cmd_run = function(cmdString) {
  let match = cmdString.match(/^show expansion "(.+)" source "(.+)"$/i);
  if (match) {
    const [_, exp, src] = match;
    filteredEvents = allEvents.filter(ev => (ev.expansion || 'Unknown Expansion') === exp && (ev.sourceName || 'Unknown Source') === src);
    window.renderEvents(filteredEvents, document.getElementById('events'));
    return;
  }
  match = cmdString.match(/^show expansion "(.+)"$/i);
  if (match) {
    const [_, exp] = match;
    filteredEvents = allEvents.filter(ev => (ev.expansion || 'Unknown Expansion') === exp);
    window.renderEvents(filteredEvents, document.getElementById('events'));
    return;
  }
  match = cmdString.match(/^show source "(.+)"$/i);
  if (match) {
    const [_, src] = match;
    filteredEvents = allEvents.filter(ev => (ev.sourceName || 'Unknown Source') === src);
    window.renderEvents(filteredEvents, document.getElementById('events'));
    return;
  }
  match = cmdString.match(/^show all$/i);
  if (match) {
    filteredEvents = allEvents;
    window.renderEvents(filteredEvents, document.getElementById('events'));
    return;
  }
  alert("Unknown command: " + cmdString);
};

document.addEventListener('DOMContentLoaded', async function() {
  allEvents = await window.loadAllEvents();
  filteredEvents = allEvents;
  window.renderEvents(filteredEvents, document.getElementById('events'));
  if (window.renderMenu) window.renderMenu(getMenuStructure(allEvents));
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
});
