// js/organize.js

import { loadAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

// Helper to create a toggle button
function createToggleButton(label) {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.cursor = 'pointer';
  button.style.marginBottom = '0.5em';
  return button;
}

// Helper to create a copy-paste bar
function createCopyPasteBar(name, location, waypoint, lootDrop) {
  const bar = document.createElement('div');
  bar.style.background = '#eee';
  bar.style.padding = '0.5em';
  bar.style.borderRadius = '4px';
  bar.style.fontFamily = 'monospace';
  bar.style.marginBottom = '0.5em';
  bar.textContent = `${name} | ${location} | ${waypoint} | ${lootDrop}`;
  return bar;
}

// Helper to create a show/hide section
function createShowHideSection(contentItems) {
  const container = document.createElement('div');
  container.style.marginBottom = '1em';

  const toggle = createToggleButton('Show Loot');
  const content = document.createElement('div');
  content.style.display = 'none';
  content.style.marginTop = '0.5em';

  toggle.addEventListener('click', () => {
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = 'Hide Loot';
    } else {
      content.style.display = 'none';
      toggle.textContent = 'Show Loot';
    }
  });

  contentItems.forEach(item => {
    const p = document.createElement('p');
    p.textContent = item;
    content.appendChild(p);
  });

  container.appendChild(toggle);
  container.appendChild(content);
  return container;
}

// Main function to organize and render data
async function displayOrganizedData() {
  const app = document.getElementById('app');
  app.textContent = 'Loading...';

  try {
    const data = await loadAllData();
    app.innerHTML = '';

    // Combine all items from all data sources into one array
    let allItems = [];
    for (const key in data) {
      if (Array.isArray(data[key])) {
        allItems = allItems.concat(data[key]);
      }
    }

    // Group by expansion
    const expansions = {};
    allItems.forEach(item => {
      const expansion = item.expansion || 'Unknown Expansion';
      if (!expansions[expansion]) expansions[expansion] = [];
      expansions[expansion].push(item);
    });

    // For each expansion create a section with toggle
    for (const [expansionName, items] of Object.entries(expansions)) {
      const expansionSection = document.createElement('section');
      const expansionHeader = document.createElement('h2');
      expansionHeader.textContent = expansionName;
      expansionHeader.style.cursor = 'pointer';
      expansionSection.appendChild(expansionHeader);

      const expansionContent = document.createElement('div');
      expansionContent.style.marginLeft = '1em';

      // Toggle expansion content
      expansionHeader.addEventListener('click', () => {
        if (expansionContent.style.display === 'none') {
          expansionContent.style.display = 'block';
        } else {
          expansionContent.style.display = 'none';
        }
      });

      // Group by sourcename within expansion
      const sources = {};
      items.forEach(item => {
        const source = item.sourcename || 'Unknown Source';
        if (!sources[source]) sources[source] = [];
        sources[source].push(item);
      });

      // For each source create a subsection
      for (const [sourceName, sourceItems] of Object.entries(sources)) {
        const sourceHeader = document.createElement('h3');
        sourceHeader.textContent = sourceName;
        sourceHeader.style.marginLeft = '1em';
        expansionContent.appendChild(sourceHeader);

        // For each item in source
        sourceItems.forEach(item => {
          const itemName = document.createElement('h4');
          itemName.textContent = item.name || 'Unnamed';
          itemName.style.marginLeft = '2em';
          expansionContent.appendChild(itemName);

          // Copy-paste bar
          const copyBar = createCopyPasteBar(
            item.name || '',
            item.location || '',
            item.waypoint || '',
            item['loot/drop'] || ''
          );
          copyBar.style.marginLeft = '2em';
          expansionContent.appendChild(copyBar);

          // Show/hide loot section
          const lootItems = Array.isArray(item.loot) ? item.loot : [];
          const lootSection = createShowHideSection(lootItems);
          lootSection.style.marginLeft = '2em';
          expansionContent.appendChild(lootSection);
        });
      }

      expansionContent.style.display = 'none'; // Initially hidden
      expansionSection.appendChild(expansionContent);
      app.appendChild(expansionSection);
    }
  } catch (error) {
    app.textContent = 'Error loading data: ' + error.message;
  }
}

window.addEventListener('DOMContentLoaded', displayOrganizedData);
