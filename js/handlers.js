export function bindHandlers(data) {
  // Search input
  const input = document.getElementById('search-input');
  input && input.addEventListener('input', function() {
    const term = input.value.toLowerCase();
    const container = document.getElementById('events-list');
    const filtered = data.filter(ev =>
      (ev.name && ev.name.toLowerCase().includes(term)) ||
      (ev.map && ev.map.toLowerCase().includes(term))
    );
    import('https://geri0v.github.io/Gamers-Hell/js/eventTable.js').then(mod => {
      mod.renderEventTables(filtered, container);
    });
  });

  // Expansion dropdown
  const expFilter = document.getElementById('expansion-filter');
  if (expFilter) {
    const options = [...new Set(data.map(ev => ev.expansion))].sort();
    expFilter.innerHTML = `<option value="">All Expansions</option>` +
      options.map(exp => `<option value="${exp}">${exp}</option>`).join('');
    expFilter.addEventListener('change', function() {
      const val = expFilter.value;
      const container = document.getElementById('events-list');
      const filtered = val ? data.filter(ev => ev.expansion === val) : data;
      import('https://geri0v.github.io/Gamers-Hell/js/eventTable.js').then(mod => {
        mod.renderEventTables(filtered, container);
      });
    });
  }

  // Rarity dropdown
  const rarFilter = document.getElementById('rarity-filter');
  if (rarFilter) {
    rarFilter.addEventListener('change', function() {
      const val = rarFilter.value;
      const container = document.getElementById('events-list');
      const filtered = val ? data.filter(ev =>
        Array.isArray(ev.loot) && ev.loot.some(item => item.rarity === val)
      ) : data;
      import('https://geri0v.github.io/Gamers-Hell/js/eventTable.js').then(mod => {
        mod.renderEventTables(filtered, container);
      });
    });
  }

  // Sort dropdown
  const sortFilter = document.getElementById('sort-filter');
  if (sortFilter) {
    sortFilter.addEventListener('change', function() {
      const key = sortFilter.value;
      const container = document.getElementById('events-list');
      let sorted = [...data];
      if (key) {
        if (key === "value") {
          import('https://geri0v.github.io/Gamers-Hell/js/copyBar.js').then(bar => {
            sorted.sort((a, b) => {
              return (bar.getMostValuableDrop(b.loot)?.price || 0) - (bar.getMostValuableDrop(a.loot)?.price || 0);
            });
            import('https://geri0v.github.io/Gamers-Hell/js/eventTable.js').then(mod => {
              mod.renderEventTables(sorted, container);
            });
          });
        } else {
          sorted.sort((a, b) => ((a[key] || '').localeCompare(b[key] || '')));
          import('https://geri0v.github.io/Gamers-Hell/js/eventTable.js').then(mod => {
            mod.renderEventTables(sorted, container);
          });
        }
      } else {
        import('https://geri0v.github.io/Gamers-Hell/js/eventTable.js').then(mod => {
          mod.renderEventTables(data, container);
        });
      }
    });
  }
}
