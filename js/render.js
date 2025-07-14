import { loadAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

// Helper: Render loot as a bulleted list
function createLootList(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return null;
  const ul = document.createElement('ul');
  loot.forEach(item => {
    const li = document.createElement('li');
    // Show both item name and chatcode if available
    li.textContent = item.name + (item.code ? ` (${item.code})` : '');
    ul.appendChild(li);
  });
  return ul;
}

// Helper: Render the copy-paste bar
function createCopyBar(event) {
  // Use the first loot item's name or code, if available
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

  // Event name and location
  const eventName = document.createElement('div');
  eventName.textContent = `${event.name || 'Unnamed Event'} (${event.map || 'Unknown Location'})`;
  eventName.style.fontWeight = 'bold';
  div.appendChild(eventName);

  // Copy-paste bar
  div.appendChild(createCopyBar(event));

  // Loot list
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

  source.events.forEach(event => {
    container.appendChild(createEventItem(event));
  });
  return container;
}

// Helper: Render a section for each expansion
function createExpansionSection(expansion) {
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = expansion.expansion;
  section.appendChild(h2);

  expansion.sources.forEach(source => {
    section.appendChild(createSourceSection(source));
  });

  return section;
}

async function displayData() {
  const app = document.getElementById('app');
  app.textContent = 'Loading...';
  try {
    // loadAllData should return an array of expansions
    const data = await loadAllData();
    app.innerHTML = '';

    (Array.isArray(data) ? data : Object.values(data)).forEach(expansion => {
      app.appendChild(createExpansionSection(expansion));
    });
  } catch (error) {
    app.textContent = 'Error loading data: ' + error.message;
    console.error("Error in displayData:", error);
  }
}

window.addEventListener('DOMContentLoaded', displayData);
