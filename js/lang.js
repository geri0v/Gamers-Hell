export const SUPPORTED_LANGS = ["en", "de", "fr", "es", "zh"];

export function detectBrowserLang() {
  const navLangs = navigator.languages || [navigator.language || "en"];
  for (let lang of navLangs) {
    lang = lang.split('-')[0].toLowerCase();
    if (SUPPORTED_LANGS.includes(lang)) return lang;
  }
  return "en";
}
export function getCurrentLang() {
  return localStorage.getItem('lang') || detectBrowserLang();
}
export function setCurrentLang(lang) {
  localStorage.setItem('lang', lang);
  window.location.reload();
}
export function langMenuHTML(current) {
  return SUPPORTED_LANGS.map(l =>
    `<button class="side-btn" data-lang="${l}" aria-label="${l.toUpperCase()} Language"${l===current?' style="font-weight:bold;"':''}>
      ${l === "en" ? "🇬🇧" : l === "de" ? "🇩🇪" : l === "fr" ? "🇫🇷" : l === "es" ? "🇪🇸" : "🇨🇳"}
    </button>`
  ).join("");
}
