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

function safeString(val) {
  return (typeof val === 'string') ? val.toLowerCase() : '';
}

// Compute event value for sorting
function getEventValue(ev) {
  if (!Array.isArray(ev.loot)) return 0;
  return Math.max(
    0,
    ...ev.loot.map(item =>
      (typeof item.tp_value === 'number' ? item.tp_value : 0) ||
      (typeof item.vendor_value === 'number' ? item.vendor_value : 0)
    )
  );
}

function applyFilters() {
  const query = safeString(document.getElementById('search').value);
  filteredEvents = allEvents.filter(ev =>
    safeString(ev.name).includes(query) ||
    safeString(ev.map).includes(query) ||
    (Array.isArray(ev.loot) && ev.loot.some(item => safeString(item.name).includes(query)))
  );
  filteredEvents.sort((a, b) => {
    let vA, vB;
    if (sortKey === 'value') {
      vA = getEventValue(a);
      vB = getEventValue(b);
    } else {
      vA = a[sortKey] || '';
      vB = b[sortKey] || '';
      if (typeof vA === 'string') vA = vA.toLowerCase();
      if (typeof vB === 'string') vB = vB.toLowerCase();
    }
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
