// Minimal i18n example (expand as needed)
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
  return translations[lang] && translations[lang][key] ? translations[lang][key] : key;
}
document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('lang-select');
  select.innerHTML = Object.keys(translations).map(l =>
    `<option value="${l}">${l.toUpperCase()}</option>`
  ).join('');
  select.value = localStorage.getItem('lang') || 'en';
  select.onchange = () => {
    localStorage.setItem('lang', select.value);
    location.reload();
  };
});
