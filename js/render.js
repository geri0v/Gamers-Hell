import { fetchAllData, groupAndSort } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';
import { enrichData, formatPrice } from 'https://geri0v.github.io/Gamers-Hell/js/loader.js';

function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}

function renderLoot(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return '';
  return `
    <div class="subcards">
      ${loot.map(l => `
        <div class="subcard${l.guaranteed ? ' guaranteed' : ''}">
          ${l.icon ? `<img src="${l.icon}" alt="" style="height:1.2em;vertical-align:middle;margin-right:0.3em;">` : ''}
          ${l.wikiLink ? `<a href="${l.wikiLink}" target="_blank">${l.name}</a>` : l.name}
          ${l.price !== undefined && l.price !== null ? `<div><strong>Price:</strong> ${formatPrice(l.price)}</div>` : ''}
          ${l.chatCode ? `<div><strong>Chatcode:</strong> ${l.chatCode}</div>` : ''}
          ${l.accountBound !== undefined ? `<div><strong>Accountbound:</strong> ${l.accountBound ? 'Yes' : 'No'}</div>` : ''}
          ${l.guaranteed ? `<div class="guaranteed-badge">Guaranteed</div>` : ''}
          ${Object.entries(l)
            .filter(([k]) => !['name','icon','wikiLink','price','chatCode','accountBound','guaranteed'].includes(k))
            .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

// Find the most valuable drop (by price, fallback to rarity)
function getMostValuableDrop(loot) {
  if (!Array.isArray(loot) || loot.length === 0) return null;
  let maxItem = null;
  for (const item of loot) {
    if (item.price && (!maxItem || item.price > maxItem.price)) maxItem = item;
  }
  if (maxItem) return maxItem;
  // Fallback: pick the first Exotic or highest rarity
  const rarityOrder = ['Ascended', 'Exotic', 'Rare', 'Masterwork', 'Fine', 'Basic'];
  return loot.slice().sort((a, b) => rarityOrder.indexOf(a.rarity || 'Basic') - rarityOrder.indexOf(b.rarity || 'Basic'))[0];
}

// Copy-paste bar logic
function createCopyBar(event) {
  const guaranteedDrops = (event.loot || []).filter(l => l.guaranteed).map(l => l.name).join(', ') || 'None';
  const mostVal = getMostValuableDrop(event.loot);
  const valDrop = mostVal ? mostVal.name : 'N/A';
  const text = `name: ${event.name} | map: ${event.map} | Waypoint: ${event.code} | Guaranteed drops: ${guaranteedDrops} | Most value Drop: ${valDrop}`;
  return `
    <div class="copy-bar">
      <input type="text" class="copy-input" value="${text.replace(/"/g, '&quot;')}" readonly>
      <button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.value)">Copy</button>
    </div>
  `;
}

export async function renderApp(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '<div>Loading...</div>';
  let allData = [];
  await fetchAllData(async (flat, url, err) => {
    if (err) {
      container.innerHTML += `<div class="error">Failed to load ${url}: ${err}</div>`;
      return;
    }
    if (flat.length === 0) return;
    // Enrich and render this chunk
    const enriched = await enrichData(flat);
    allData = allData.concat(enriched);
    const grouped = groupAndSort(allData);

    container.innerHTML = '';
    grouped.forEach(exp => {
      const expDiv = createCard('expansion-card', `<h2>${exp.expansion}</h2>`);
      exp.sources.forEach(src => {
        const srcDiv = createCard('source-card', `<h3>${src.sourcename}</h3>`);
        src.items.forEach(item => {
          const details = Object.entries(item)
            .filter(([k]) => k !== 'loot' && k !== 'expansion' && k !== 'sourcename')
            .map(([k, v]) => {
              if (k === 'wikiLink' && v) return `<div><strong>Wiki:</strong> <a href="${v}" target="_blank">${item.name}</a></div>`;
              if (k === 'mapWikiLink' && v) return `<div><strong>Map Wiki:</strong> <a href="${v}" target="_blank">${item.map}</a></div>`;
              return `<div><strong>${k}:</strong> ${Array.isArray(v) ? JSON.stringify(v) : v}</div>`;
            })
            .join('');
          const lootSection = renderLoot(item.loot);
          const copyBar = createCopyBar(item);
          const itemDiv = createCard('item-card', `<div>${details}${lootSection}${copyBar}</div>`);
          srcDiv.appendChild(itemDiv);
        });
        expDiv.appendChild(srcDiv);
      });
      container.appendChild(expDiv);
    });
  });
}

renderApp('app');
