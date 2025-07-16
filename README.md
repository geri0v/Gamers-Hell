# 🧭 Guild Wars 2 Event & Loot Visualizer

A dynamic, filterable, and mobile-friendly event viewer for Guild Wars 2 — enriched with real-time marketplace data, loot drops, wiki integration, and fully client-side. Built to run directly on GitHub Pages or any static host.

---

## ✨ Features

| Feature                           | Description                                               |
|----------------------------------|-----------------------------------------------------------|
| 📦 Static Data + Live Enrichment | Displays structured event data while enriching live via GW2 APIs |
| 📘 Wiki-Linked Waypoints         | Resolves `chat_code` to real waypoint names + wiki links |
| 🖼 Natural Icons                 | Item icons shown in their original sizing (no stretch)    |
| 🔁 Infinite Scroll               | Keep loading more results without clicking next page      |
| 📋 Copy Bar                      | Copy event text / chatcodes in one click                  |
| 🎯 Dynamic Search & Filter      | Search by event, loot, expansion, rarity, and more        |
| 🎨 Light Theme UI + Event Separator Lines | Clean cards, thematic color separators          |
| ↕️ Sortable Columns              | Click table headers to sort Name, Map, Waypoint, Value    |
| 🆘 Help + README Popup           | Friendly ❓ help overlay and 📄 README viewer              |
| ⬆ Sticky “Back to Top” Button   | Scrolls up with ease after browsing                       |

---

## 🚀 Getting Started

No install required — simply host on GitHub Pages or open with a browser.

### 🔗 Live Demo

> [Open in GitHub Pages](https://geri0v.github.io/Gamers-Hell/)

### 📁 Folder Structure

Gamers-Hell/
├── index.html # Main entry point
├── js/
│ ├── render.js # UI renderer
│ ├── infoload.js # Enrichment orchestrator
│ ├── waypoint.js # Dynamic WP resolver via GW2 API
│ ├── info.js # Item info + description fetch
│ ├── data.js # CSV/json loader
│ ├── search.js # Filter support
│ ├── pagination.js # Infinite scroll logic
│ └── copy.js # Copy-to-clipboard bar
├── style/
│ └── style.css # Final themed stylesheet
└── README.md # This file


---

## 🔌 APIs Used

- [Guild Wars 2 API](https://wiki.guildwars2.com/wiki/API)
- [Wiki Extractor](https://wiki.guildwars2.com/api.php)
- [GW2Treasure.com (optional)](https://api.gw2treasures.com/items/...)

---

## 📈 Performance Tips

- All icons use `loading="lazy"` to reduce memory strain on long lists
- Data only loads once, and scroll appends just what's paginated
- No toggle-collapse = zero DOM mutation bugs or visibility issues

---

## 👨‍💻 Contributions

Want to expand the source database?  
- Just drop JSONs in `/json/` + `manifest.json`
- Fork + PR if you want to patch UI/data

---

## 🔒 License

MIT — free to build, break, improve.

---

💬 Feedback or bugs?  
Open an issue or contact `geri0v` on GitHub.

