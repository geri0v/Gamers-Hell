export const SUPPORTED_LANGS = ["en", "de", "fr", "es", "zh"];

export function detectBrowserLang() {
  const navLangs = navigator.languages ? navigator.languages : [navigator.language || "en"];
  for (let lang of navLangs) {
    lang = lang.split('-')[0].toLowerCase();
    if (SUPPORTED_LANGS.includes(lang)) return lang;
  }
  return "en";
}

export function listLangOptionsHTML(current) {
  return SUPPORTED_LANGS.map(l => `<button class="side-btn" data-lang="${l}" aria-label="${l.toUpperCase()} Language"${l===current?' style="font-weight:bold;"':''}>${langIcon(l)}</button>`).join("");
}

function langIcon(l) {
  switch(l) {
    case "de": return "🇩🇪";
    case "fr": return "🇫🇷";
    case "es": return "🇪🇸";
    case "zh": return "🇨🇳";
    default: return "🇬🇧";
  }
}

export function setCurrentLang(lang) {
  localStorage.setItem('lang', lang);
  window.location.reload();
}

export function getCurrentLang() {
  return localStorage.getItem('lang') || detectBrowserLang();
}

// Returns a url for wiki in selected lang, else fallback to en
export function getWikiLink(name, lang) {
  const sub = lang !== 'en' ? `${lang}.` : '';
  return `https://${sub}wiki.guildwars2.com/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`;
}
