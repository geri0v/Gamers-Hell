// js/render.js

import { loadAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

// Helper to create a section for each expansion
function createExpansionSection(expansion, items) {
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = expansion;
  section.appendChild(h2);

  const list = document.createElement('ul');
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.name || JSON.stringify(item);
    list.appendChild(li);
  });
  section.appendChild(list);
  return section;
}

async function displayData() {
  const app = document.getElementById('app');
  app.textContent = 'Loading...';
  try {
    const data = await loadAllData();
    app.innerHTML = '';

    // Step 2: Combine all items and group by expansion
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

    // Render each expansion group
    for (const [expansion, items] of Object.entries(expansions)) {
      app.appendChild(createExpansionSection(expansion, items));
    }
  } catch (error) {
    app.textContent = 'Error loading data: ' + error.message;
  }
}

window.addEventListener('DOMContentLoaded', displayData);
