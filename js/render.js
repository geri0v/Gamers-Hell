import { loadAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

// Helper: Render loot as a bulleted list
function createLootList(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return null;
  const ul = document.createElement('ul');
  loot.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.name || JSON.stringify(item);
    ul.appendChild(li);
  });
  return ul;
}

// Helper: Render a single event (event name, copy bar placeholder, loot)
function createEventItem(event) {
  const div = document.createElement('div');
  div.style.marginLeft = '2em';

  // Event name
  const eventName = document.createElement('div');
  eventName.textContent = event.name || 'Unnamed Event';
  eventName.style.fontWeight = 'bold';
  div.appendChild(eventName);

  // Placeholder for copy-paste bar
  const copyBar = document.createElement('div');
  copyBar.textContent = '(Copy-paste bar here)';
  copyBar.style.fontFamily = 'monospace';
  copyBar.style.background = '#f0f0f0';
  copyBar.style.padding = '0.25em 0.5em';
  copyBar.style.margin = '0.25em 0 0.25em 0';
  copyBar.style.borderRadius = '4px';
  div.appendChild(copyBar);

  // Loot list
  const lootList = createLootList(event.loot);
  if (lootList) {
    lootList.style.marginLeft = '2em';
    div.appendChild(lootList);
  }
  return div;
}

// Helper: Render all events for a source
function createSourceSection(sourceName, events) {
  const container = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.textContent = sourceName;
  container.appendChild(h3);

  events.forEach(event => {
    container.appendChild(createEventItem(event));
  });
  return container;
}

// Helper: Render a section for each expansion
function createExpansionSection(expansion, sources) {
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = expansion;
  section.appendChild(h2);

  sources.forEach(({ sourceName, events }) => {
    section.appendChild(createSourceSection(sourceName, events));
  });

  return section;
}

async function displayData() {
  const app = document.getElementById('app');
  app.textContent = 'Loading...';
  try {
    const data = await loadAllData();
    app.innerHTML = '';

    // Flatten events and attach expansion/sourceName
    let allEvents = [];
    for (const key in data) {
      const source = data[key];
      if (source && Array.isArray(source.events)) {
        source.events.forEach(event => {
          event.expansion = event.expansion || source.expansion || 'Unknown Expansion';
          event.sourceName = event.sourceName || source.sourceName || 'Unknown Source';
          allEvents.push(event);
        });
      }
    }

    // Group: expansion -> sourceName -> [events]
    const expansionMap = {};
    allEvents.forEach(event => {
      const expansion = event.expansion;
      const sourceName = event.sourceName;
      if (!expansionMap[expansion]) expansionMap[expansion] = {};
      if (!expansionMap[expansion][sourceName]) expansionMap[expansion][sourceName] = [];
      expansionMap[expansion][sourceName].push(event);
    });

    // Render
    for (const [expansion, sourcesObj] of Object.entries(expansionMap)) {
      const sources = [];
      for (const [sourceName, events] of Object.entries(sourcesObj)) {
        sources.push({ sourceName, events });
      }
      app.appendChild(createExpansionSection(expansion, sources));
    }
  } catch (error) {
    app.textContent = 'Error loading data: ' + error.message;
    console.error("Error in displayData:", error);
  }
}

window.addEventListener('DOMContentLoaded', displayData);
