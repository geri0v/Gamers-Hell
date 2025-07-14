// == Gamers-Hell: lang.js ==

const translations = {
  en: {
    "Search events, maps, loot...": "Search events, maps, loot...",
    "Event Timer": "Event Timer",
    "Next event starts soon!": "Next event starts soon!",
    "Name": "Name",
    "Location": "Location",
    "Source": "Source",
    "Loot Value": "Loot Value"
  },
  // Add more languages here
};

function t(key) {
  const lang = localStorage.getItem('lang') || 'en';
  if (translations[lang] && translations[lang][key]) return translations[lang][key];
  // Warn if missing translation
  if (!translations[lang] || !translations[lang][key]) {
    console.warn(`Missing translation for "${key}" in "${lang}"`);
  }
  return key;
}

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('lang-select');
  if (!select) return;
  select.innerHTML = Object.keys(translations).map(l =>
    `<option value="${l}">${l.toUpperCase()}</option>`
  ).join('');
  select.value = localStorage.getItem('lang') || 'en';
  select.onchange = () => {
    localStorage.setItem('lang', select.value);
    location.reload();
  };
});
