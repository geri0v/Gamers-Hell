// render.js
import { fetchAllData, groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

function renderSubdata(item) {
  if (!item.subdata || !Array.isArray(item.subdata)) return '';
  return `
    <div class="subcards">
      ${item.subdata.map(sub =>
        `<div class="subcard">
          ${Object.entries(sub).map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('')}
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
          const itemDiv = createCard(
            'item-card',
            `
              <div>
                ${Object.entries(item)
                  .filter(([k]) => k !== 'subdata')
                  .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
                  .join('')}
                ${renderSubdata(item)}
              </div>
            `
          );
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
