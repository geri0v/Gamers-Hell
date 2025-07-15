// https://geri0v.github.io/Gamers-Hell/js/lang.js

export const SUPPORTED_LANGS = ["en", "de", "fr", "es", "zh"];

export function detectBrowserLang() {
  const navLangs = navigator.languages ? navigator.languages : [navigator.language || "en"];
  for (let lang of navLangs) {
    lang = lang.split('-')[0].toLowerCase();
    if (SUPPORTED_LANGS.includes(lang)) return lang;
  }
  return "en";
}

export async function fetchGW2Translation(type, id, lang) {
  // type: "items", "maps", etc. id: GW2 id, lang: "en", "de"...
  try {
    const res = await fetch(`https://api.guildwars2.com/v2/${type}/${id}?lang=${lang}`);
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export async function fetchWikiSnippet(name, lang) {
  // Only works reliably for "en", "de", "fr", "es", "zh"
  // Uses MW API.
  const domain = lang === "en"
    ? "wiki.guildwars2.com"
    : `${lang}.wiki.guildwars2.com`;
  const url = `https://${domain}/api.php?action=query&prop=extracts&exintro&exsentences=2&format=json&origin=*&titles=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.query || !data.query.pages) return null;
    for (const k of Object.keys(data.query.pages)) {
      if (data.query.pages[k].extract) return data.query.pages[k].extract.replace(/<[^>]+>/g, '').trim();
    }
  } catch {}
  return null;
}
