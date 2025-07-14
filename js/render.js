import { loadAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

async function displayData() {
  const app = document.getElementById('app');
  app.textContent = 'Loading...';
  try {
    const data = await loadAllData();
    app.innerHTML = '';

    (Array.isArray(data) ? data : Object.values(data)).forEach(expansion => {
      // Expansion heading
      const section = document.createElement('section');
      const h2 = document.createElement('h2');
      h2.textContent = expansion.expansion;
      section.appendChild(h2);

      // Each source under this expansion
      if (Array.isArray(expansion.sources)) {
        expansion.sources.forEach(source => {
          const h3 = document.createElement('h3');
          h3.textContent = source.sourceName;
          section.appendChild(h3);

          // List of events under this source
          if (Array.isArray(source.events)) {
            const ul = document.createElement('ul');
            source.events.forEach(event => {
              const li = document.createElement('li');
              li.textContent = `${event.name || 'Unnamed Event'} (${event.map || 'Unknown Location'})`;
              ul.appendChild(li);
            });
            section.appendChild(ul);
          }
        });
      }
      app.appendChild(section);
    });
  } catch (error) {
    app.textContent = 'Error loading data: ' + error.message;
    console.error("Error in displayData:", error);
  }
}

window.addEventListener('DOMContentLoaded', displayData);
