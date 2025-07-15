export function generateWikiLink(name, lang = "en") {
  if (!name) return null;
  const sub = lang !== "en" ? lang + "." : "";
  return `https://${sub}wiki.guildwars2.com/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`;
}
