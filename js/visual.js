// visual.js
import { loadAndEnrichData } from './infoload.js';
import { filterEvents } from './search.js';
import { createCopyBar, createMostValuableBadge } from './copy.js';

// Terminal-like loader output logic
function appendTerminal(message, type = 'info') {
  const term = document.querySelector('#terminal');
  if (!term) return;
  const line = document.createElement('pre');
  line.className = `terminal-line terminal-${type}`;
  line.textContent = message;
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}

function clearTerminal() {
  const term = document.querySelector('#terminal');
  if (term) term.innerHTML = '';
}

async function bootApp() {
  clearTerminal();
  appendTerminal('Initializing Guild Wars 2 Event Loot Browser...', 'info');
  appendTerminal('Fetching and enriching event data...', 'progress');

  // Step-by-step loading feedback:
  const events = await loadAndEnrichData(ev => {
    if (ev.name) {
      appendTerminal(`Event loaded: ${ev.name} [${ev.map}]`, 'success');
    }
  });

  if (!events.length) {
    appendTerminal('No events found. Please try again later.', 'error');
    return;
  }

  appendTerminal(`Loaded ${events.length} events! Rendering app...`, 'success');
  renderEventList(events);
  appendTerminal('App ready. Use the search or browse below.', 'info');
}

// Main event list rendering
function renderEventList(events, filters = {}) {
  const app = document.querySelector('#app');
  if (!app) return;
  app.innerHTML = '';

  // Search Bar
  const searchWrap = document.createElement('div');
  searchWrap.className = 'search-bar';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search events or maps...';
  input.autocomplete = 'off';

  input.addEventListener('input', e => {
    const filtered = filterEvents(events, { searchTerm: e.target.value });
    renderEventList(filtered);
  });

  searchWrap.appendChild(input);
  app.appendChild(searchWrap);

  // Event Cards
  const list = document.createElement('div');
  list.className = 'event-list';

  if (events.length === 0) {
    const none = document.createElement('div');
    none.className = 'no-results';
    none.textContent = 'No events found with this filter.';
    list.appendChild(none);
  }

  events.forEach(ev => {
    const card = document.createElement('section');
    card.className = 'event-card';

    // Header + Wiki
    const title = document.createElement('h3');
    title.innerHTML = `<a href="${ev.wikiLink}" target="_blank">${ev.name || 'Unknown Event'}</a>` +
      (ev.description ? `<span class="desc">${ev.description}</span>` : '');

    card.appendChild(title);

    // Map, waypoint, and links
    const meta = document.createElement('div');
    meta.className = 'event-meta';
    meta.innerHTML = `
      <span><b>Map:</b> <a href="${ev.mapWikiLink}" target="_blank">${ev.map || '?'}</a></span>
      <span><b>Waypoint:</b> ${ev.waypointName ?
        `<a href="${ev.waypointWikiLink}" target="_blank">${ev.waypointName}</a>` : ev.code || '-'}</span>
    `;
    card.appendChild(meta);

    // Loot
    if (ev.loot?.length) {
      const lootList = document.createElement('ul');
      lootList.className = 'loot-list';
      ev.loot.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML =
          (item.icon ? `<img src="${item.icon}" class="loot-icon" alt="${item.name}"/> ` : '') +
          `<a href="${item.wikiLink}" target="_blank">${item.name}</a> ` +
          (item.price ? `<span class="prices">(${item.price}c)</span>` : '') +
          (item.guaranteed ? '<span class="loot-gtd">[Guaranteed]</span>' : '') +
          createMostValuableBadge(item.price === Math.max(...ev.loot.filter(l => l.price).map(l => l.price)) ? item : null);
        lootList.appendChild(li);
      });
      card.appendChild(lootList);
    }

    // Copy Bar
    card.insertAdjacentHTML('beforeend', createCopyBar(ev));
    list.appendChild(card);
  });

  app.appendChild(list);
}

window.addEventListener('DOMContentLoaded', bootApp);
