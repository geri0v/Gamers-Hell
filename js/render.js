import { loadAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

// Helper to create a list of events under a source
function createEventList(events) {
  const ul = document.createElement('ul');
  events.forEach(event => {
    const li = document.createElement('li');
    li.textContent = event.name || JSON.stringify(event);
    ul.appendChild(li);
  });
  return ul;
}

// Helper to create the source name section with its events
function createSourceSection(sourceName, events) {
  const div = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.textContent = sourceName;
  div.appendChild(h3);
  div.appendChild(createEventList(events));
  return div;
}

// Helper to create the expansion section with all its sources
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

    // Step 1: Collect all events and attach expansion and sourceName if missing
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

    // Step 2: Group by expansion, then by sourceName
    const expansionMap = {};
    allEvents.forEach(event => {
      const expansion = event.expansion;
      const sourceName = event.sourceName;
      if (!expansionMap[expansion]) expansionMap[expansion] = {};
      if (!expansionMap[expansion][sourceName]) expansionMap[expansion][sourceName] = [];
      expansionMap[expansion][sourceName].push(event);
    });

    // Step 3: Render the grouped view
    for (const [expansion, sourcesObj] of Object.entries(expansionMap)) {
      // Prepare sources for this expansion
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
