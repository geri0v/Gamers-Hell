// Theme Switcher
const themes = [
  { key: "original", label: "Original" },
  { key: "darkfantasy", label: "Dark Fantasy" },
  { key: "lightfantasy", label: "Light Fantasy" }
];
function setTheme(theme) {
  document.body.classList.remove(...themes.map(t => 'theme-' + t.key));
  document.body.classList.add('theme-' + theme);
  localStorage.setItem('theme', theme);
  document.getElementById('theme-toggle').textContent = themes.find(t => t.key === theme).label;
}
document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('theme') || 'original';
  setTheme(theme);
  const btn = document.getElementById('theme-toggle');
  btn.textContent = themes.find(t => t.key === theme).label;
  btn.onclick = () => {
    const idx = themes.findIndex(t => t.key === (localStorage.getItem('theme') || 'original'));
    const next = themes[(idx + 1) % themes.length].key;
    setTheme(next);
  };
});
