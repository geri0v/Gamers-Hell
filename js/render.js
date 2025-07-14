import { loadAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

// Helper: Render loot as a bulleted list
function createLootList(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return null;
  const ul = document.createElement('ul');
  loot.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.name + (item.code ? ` (${item.code})` : '');
    ul.appendChild(li);
  });
  return ul;
}

// Helper: Render the copy-paste bar
function createCopyBar(event) {
  let lootLabel = '';
  if (Array.isArray(event.loot) && event.loot.length > 0) {
    const firstLoot = event.loot[0];
    lootLabel = firstLoot.name || '';
    if (firstLoot.code) lootLabel += ` (${firstLoot.code})`;
  }
  const bar = document.createElement('div');
  bar.textContent = [
    event.name || '',
    event.map || '',
    event.code || '',
    lootLabel
  ].join(' | ');
  bar.style.fontFamily = 'monospace';
  bar.style.background = '#f0f0f0';
  bar.style.padding = '0.25em 0.5em';
  bar.style.margin = '0.25em 0 0.25em 0';
  bar.style.borderRadius = '4px';
  return bar;
}

// Helper: Render a single event
function createEventItem(event) {
  const div = document.createElement('div');
  div.style.marginLeft = '2em';

  const eventName = document.createElement('div');
  eventName.textContent = `${event.name || 'Unnamed Event'} (${event.map || 'Unknown Location'})`;
  eventName.style.fontWeight = 'bold';
  div.appendChild(eventName);

  div.appendChild(createCopyBar(event));

  const lootList = createLootList(event.loot);
  if (lootList) {
    lootList.style.marginLeft = '2em';
    div.appendChild(lootList);
  }
  return div;
}

// Helper: Render all events for a source
function createSourceSection(source) {
  const container = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.textContent = source.sourceName;
  container.appendChild(h3);

  if (Array.isArray(source.events)) {
    source.events.forEach(event => {
      container.appendChild(createEventItem(event));
    });
  } else {
    const warning = document.createElement('div');
    warning.textContent = 'No events found for this source.';
    warning.style.color = 'red';
    container.appendChild(warning);
  }
  return container;
}

// Helper: Render a section for each expansion, with defensive check
function createExpansionSection(expansion) {
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = expansion.expansion;
  section.appendChild(h2);

  if (Array.isArray(expansion.sources)) {
    expansion.sources.forEach(source => {
      section.appendChild(createSourceSection(source));
    });
  } else {
    const warning = document.createElement('div');
    warning.textContent = 'No sources found for this expansion.';
    warning.style.color = 'red';
    section.appendChild(warning);
  }

  return section;
}

async function displayData() {
  const app = document.getElementById('app');
  app.textContent = 'Loading...';
  try {
    const data = await loadAllData();
    app.innerHTML = '';

    // Defensive: handle if data is array or object
    const expansions = Array.isArray(data) ? data : Object.values(data);

    expansions.forEach(expansion => {
      app.appendChild(createExpansionSection(expansion));
    });
  } catch (error) {
    app.textContent = 'Error loading data: ' + error.message;
    console.error("Error in displayData:", error);
  }
}

window.addEventListener('DOMContentLoaded', displayData);
