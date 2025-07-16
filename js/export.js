// export.js

/**
 * Export event (or event group) loot data to JSON file.
 *
 * @param {Object|Array} eventOrEvents - Single event OR array of events
 * @param {String} [filename] - Optional filename; will auto-generate if not supplied
 */
export function exportEventAsJSON(eventOrEvents, filename = null) {
  const data = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];
  const pretty = JSON.stringify(data, null, 2);
  const file = filename || generateFilename(data, "json");
  triggerDownload(pretty, file, "application/json");
}

/**
 * Export event (or group) loot data to CSV file.
 *
 * @param {Object|Array} eventOrEvents - Single event OR array of events
 * @param {String} [filename]
 */
export function exportEventAsCSV(eventOrEvents, filename = null) {
  const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];

  // Compose CSV headers
  const headers = [
    "Event Name",
    "Map",
    "Expansion",
    "Waypoint",
    "Item Name",
    "Rarity",
    "Guaranteed",
    "Collectible",
    "AchievementLinked",
    "AccountBound",
    "Chatcode",
    "TP Link",
    "Wiki URL"
  ];

  const rows = [];
  for (const event of events) {
    for (const item of (event.loot || [])) {
      rows.push([
        quote(event.name),
        quote(event.map),
        quote(event.expansion),
        quote(event.waypoint || ""),
        quote(item.name),
        quote(item.rarity),
        item.guaranteed ? "Yes" : "",
        item.collectible ? "Yes" : "",
        item.achievementLinked ? "Yes" : "",
        item.accountBound ? "Yes" : "",
        quote(item.chatcode || ""),
        quote(item.tp || ""),
        quote(item.wikiUrl || "")
      ]);
    }
  }

  const csv =
    headers.join(",") +
    "\n" +
    rows
      .map(row => row.join(","))
      .join("\n");

  const file = filename || generateFilename(events, "csv");
  triggerDownload(csv, file, "text/csv");
}

/**
 * Quotes a value for CSV, escaping internal quotes.
 */
function quote(val) {
  const s = String(val || "");
  if (s.match(/[,"\n]/)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Generate a nice filename.
 */
function generateFilename(events, ext) {
  let n = "event-loot-export";
  if (events.length === 1) {
    const ev = events[0];
    if (ev.name && ev.map) n = `${ev.map}-${ev.name}`.replace(/[^\w]+/g, "_");
    else if (ev.name) n = ev.name.replace(/[^\w]+/g, "_");
  } else if (events.length > 1 && events[0].map) {
    // Use map name if exporting map group
    n = `${events[0].map}-loot`.replace(/[^\w]+/g, "_");
  }
  return `${n}.${ext}`;
}

/**
 * Triggers download for the content.
 */
function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
