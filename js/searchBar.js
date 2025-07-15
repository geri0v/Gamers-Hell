export function renderSearchBar() {
  return `
    <div id="main-controls-wrap">
      <div class="search-sort-card">
        <div class="search-bar-row">
          <input id="search-input" aria-label="Search events or map" type="text" placeholder="Search event or map..." />
        </div>
        <div class="filter-row">
          <select id="expansion-filter" aria-label="Filter by Expansion"><option value="">All Expansions</option></select>
          <select id="rarity-filter" aria-label="Filter by Rarity">
            <option value="">All Rarities</option>
            <option value="Ascended">Ascended</option>
            <option value="Exotic">Exotic</option>
            <option value="Rare">Rare</option>
            <option value="Masterwork">Masterwork</option>
            <option value="Fine">Fine</option>
            <option value="Basic">Basic</option>
          </select>
        </div>
        <div class="sort-row">
          <select id="sort-filter" aria-label="Sort by">
            <option value="">Sort By</option>
            <option value="name">Name</option>
            <option value="expansion">Expansion</option>
            <option value="map">Map</option>
            <option value="value">Value</option>
          </select>
        </div>
      </div>
    </div>
  `;
}
