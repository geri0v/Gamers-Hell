// js/render.js

// Import the data loader from your GitHub Pages (github.io) deployment
import { loadAllData } from 'https://geri0v.github.io/Gamers-Hell/js/data.js';

// Helper to create a section for each data set
function createSection(title, items) {
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = title;
  section.appendChild(h2);

  const list = document.createElement('ul');
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = typeof item === 'object' ? JSON.stringify(item) : item;
    list.appendChild(li);
  });
  section.appendChild(list);
  return section;
}

// Main rendering function
async function displayData() {
  const app = document.getElementById('app');
  app.textContent = 'Loading...';
  try {
    const data = await loadAllData();
    app.innerHTML = '';
    for (const [key, items] of Object.entries(data)) {
      app.appendChild(createSection(key, Array.isArray(items) ? items : [items]));
    }
  } catch (error) {
    app.textContent = 'Error loading data: ' + error.message;
  }
}

// Run on DOM ready
window.addEventListener('DOMContentLoaded', displayData);
