// cmd.js

// Utility: Convert value in copper to gold/silver/copper string
function formatValue(copper) {
    if (!copper || isNaN(copper)) return '-';
    const gold = Math.floor(copper / 10000);
    const silver = Math.floor((copper % 10000) / 100);
    const copperRem = copper % 100;
    return `${gold} <span class="gold"></span> ${silver} <span class="silver"></span> ${copperRem} <span class="copper"></span>`;
}

// Utility: Copy text to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
}

// Fetch JSON data and initialize app
async function initApp() {
    const urls = [
        'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
        'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json'
    ];

    let temples = [], untimedcore = [];
    try {
        [temples, untimedcore] = await Promise.all(urls.map(url => fetch(url).then(r => r.json())));
    } catch (e) {
        document.getElementById('cmd-app').innerHTML = `<div style="color:red;text-align:center;">Failed to fetch data.<br>${e.message}</div>`;
        window.cmdAppLoaded = true;
        return;
    }

    // Merge and group data by expansion and then by sourceName
    const allData = [...temples, ...untimedcore];
    const grouped = {};
    allData.forEach(entry => {
        if (!entry.expansion || !entry.sourceName) return;
        if (!grouped[entry.expansion]) grouped[entry.expansion] = {};
        if (!grouped[entry.expansion][entry.sourceName]) grouped[entry.expansion][entry.sourceName] = [];
        grouped[entry.expansion][entry.sourceName].push(entry);
    });

    // Render
    const container = document.getElementById('cmd-app');
    container.innerHTML = '';
    Object.entries(grouped).forEach(([expansion, sources]) => {
        const expDiv = document.createElement('div');
        expDiv.className = 'expansion';
        expDiv.innerHTML = `<h2>${expansion}</h2>`;
        Object.entries(sources).forEach(([source, entries]) => {
            const srcDiv = document.createElement('div');
            srcDiv.className = 'source';
            srcDiv.innerHTML = `<h3>${source}</h3>`;
            entries.forEach(entry => {
                // Find most valued sellable item
                const items = entry.items || [];
                let mostValuable = {name: '-', value: 0};
                items.forEach(item => {
                    if (item.sellable && item.value > mostValuable.value) {
                        mostValuable = item;
                    }
                });

                const entryDiv = document.createElement('div');
                entryDiv.className = 'entry';

                // Main row: Waypoint | Location | Most valued sellable item
                entryDiv.innerHTML = `
                    <div class="main-row">
                        <span class="waypoint">${entry.waypoint || '-'}</span>
                        <span class="location">${entry.location || '-'}</span>
                        <span class="item">
                            <span class="item-name">${mostValuable.name}</span>
                            <span class="item-value">${formatValue(mostValuable.value)}</span>
                            <button class="copy-btn" title="Copy item name">Copy</button>
                        </span>
                    </div>
                    <button class="toggle-btn">Show Drops</button>
                    <div class="drops" style="display:none;">
                        <ul>
                            ${items.map(i => `<li>${i.name} (${i.sellable ? 'Sellable' : 'Not sellable'}${i.value ? ', ' + formatValue(i.value) : ''})</li>`).join('')}
                        </ul>
                    </div>
                `;

                // Copy button
                entryDiv.querySelector('.copy-btn').onclick = () => copyToClipboard(mostValuable.name);

                // Toggle drops
                const toggleBtn = entryDiv.querySelector('.toggle-btn');
                const dropsDiv = entryDiv.querySelector('.drops');
                toggleBtn.onclick = () => {
                    if (dropsDiv.style.display === 'none') {
                        dropsDiv.style.display = 'block';
                        toggleBtn.textContent = 'Hide Drops';
                    } else {
                        dropsDiv.style.display = 'none';
                        toggleBtn.textContent = 'Show Drops';
                    }
                };

                srcDiv.appendChild(entryDiv);
            });
            expDiv.appendChild(srcDiv);
        });
        container.appendChild(expDiv);
    });

    // Signal to index.html that the app loaded successfully
    window.cmdAppLoaded = true;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
