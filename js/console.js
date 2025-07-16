// js/console.js
// Drop-in debug tools — load this early in index.html or render.js

(function() {
  // Toggle debug output via global flag
  window.DEBUG_GW2 = location.hash.includes("debug");

  // Pretty print selected events to the console
  window.printEvents = function(events, limit = 5) {
    if (!Array.isArray(events)) {
      console.log("[PrintEvents] Not an event array:", events);
      return;
    }
    events.slice(0, limit).forEach((e, i) => {
      console.log(`[Event ${i + 1}]`, {
        name: e.name,
        map: e.map,
        code: e.code,
        waypoint: e.waypointName,
        loot: (e.loot || []).map(l => l.name)
      });
    });
    if (events.length > limit) {
      console.log(`And ${events.length - limit} more events...`);
    }
  };

  // Print list of waypoint resolutions
  window.printWaypoints = function(waypointMap) {
    if (typeof waypointMap !== "object") {
      console.log("[PrintWaypoints] Not a map object:", waypointMap);
      return;
    }
    Object.entries(waypointMap).forEach(([code, wp]) => {
      console.log(`[WP] ${code}: ${wp?.name || "???"} — ${wp?.wiki || "(no wiki)"}`);
    });
  };

  // Debug utilities for network/API status
  window.printApiStatus = function(label, obj) {
    console.log(`[API] ${label}:`, obj);
  };

  // App boot notice (only fires in debug mode)
  if (window.DEBUG_GW2) {
    console.log("🪛 [GW2 Console.js] Debug helpers loaded.");
  }

  // Optional global error logging
  window.addEventListener("error", e => {
    if (window.DEBUG_GW2) {
      console.error("[GW2 ERROR]", e.message, e.filename, ":", e.lineno);
    }
  });
})();
