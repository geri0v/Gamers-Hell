// render.js
import { fetchAllData, groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

// Helper to render loot/items as subcards if present
function renderLoot(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return '';
  return `
    <div class="subcards">
      ${loot.map(l =>
        `<div class="subcard">
          ${Object.entries(l).map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('')}
        </div>`
      ).join('')}
    </div>
  `;
}

export async function renderApp(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '<div>Loading...</div>';
  try {
    const rawData = await fetchAllData();
    const grouped = groupAndSort(rawData);

    container.innerHTML = '';
    grouped.forEach(exp => {
      const expDiv = createCard('expansion-card', `<h2>${exp.expansion}</h2>`);
      exp.sources.forEach(src => {
        const srcDiv = createCard('source-card', `<h3>${src.sourcename}</h3>`);
        src.items.forEach(item => {
          // Exclude loot from main details
          const details = Object.entries(item)
            .filter(([k]) => k !== 'loot' && k !== 'expansion' && k !== 'sourcename')
            .map(([k, v]) => `<div><strong>${k}:</strong> ${Array.isArray(v) ? JSON.stringify(v) : v}</div>`)
            .join('');
          const lootSection = renderLoot(item.loot);
          const itemDiv = createCard('item-card', `<div>${details}${lootSection}</div>`);
          srcDiv.appendChild(itemDiv);
        });
        expDiv.appendChild(srcDiv);
      });
      container.appendChild(expDiv);
    });
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load data: ${e}</div>`;
  }
}
renderApp('app');
