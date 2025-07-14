// js/data.js

async function tryFetch(urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (e) {
      // Try next URL
    }
  }
  throw new Error("All sources failed: " + urls.join(', '));
}

export async function loadAllData() {
  const files = {
    temples: [
      'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/temples.json',
      'https://geri0v.github.io/Gamers-Hell/json/core/temples.json'
    ],
    untimedcore: [
      'https://raw.githubusercontent.com/geri0v/Gamers-Hell/refs/heads/main/json/core/untimedcore.json',
      'https://geri0v.github.io/Gamers-Hell/json/core/untimedcore.json'
    ]
  };

  const data = {};
  for (const [key, urls] of Object.entries(files)) {
    data[key] = await tryFetch(urls);
  }
  return data;
}
