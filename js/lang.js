// https://geri0v.github.io/Gamers-Hell/js/lang.js

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

// ✅ Correct export: langMenuHTML
export function langMenuHTML(current) {
  return SUPPORTED_LANGS.map(lang => {
    const flag = {
      en: "🇬🇧",
      de: "🇩🇪",
      fr: "🇫🇷",
      es: "🇪🇸",
      zh: "🇨🇳"
    }[lang] || "🌐";
    return `<button class="side-btn" data-lang="${lang}" aria-label="${lang.toUpperCase()} Language"${lang === current ? ' style="font-weight:bold;"' : ''}>${flag}</button>`;
  }).join("");
}
