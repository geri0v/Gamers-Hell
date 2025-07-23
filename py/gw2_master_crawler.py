import os
import csv
import json
import re
import time
import requests
from bs4 import BeautifulSoup
from rapidfuzz import fuzz, process
from tqdm import tqdm

# === CONFIG ===
DATA_DIR = "data/maps"
os.makedirs(DATA_DIR, exist_ok=True)

SLEEP = 0.15
GW2T_TOKEN = "df70c529-b684-4d81-b882-7e2665de3afe"

def sleep(): time.sleep(SLEEP)

# === UTILS ===

def fetch_html(url):
    sleep()
    try:
        r = requests.get(url, timeout=15)
        if r.status_code == 200:
            return r.text
        print(f"❌ [{r.status_code}] Failed to fetch {url}")
    except Exception as e:
        print(f"❌ Exception fetching {url}: {e}")
    return ""

def load_csv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))

def to_slug(name):
    return name.lower().replace(" ", "_").replace(":", "").replace("'", "").replace("-", "_")

def strip_html(text):
    return re.sub(r"<[^>]+>", "", text or "").strip()

def first_sentences(text, n=2):
    s = text.strip().split('. ')
    return '. '.join(s[:n]) + ('. (see wiki)' if len(s) > n else '')

def is_container(name):
    return re.search(r'chest|bag|cache|container|satchel|box|reward|sack', name, re.I)

# === MAP DISCOVERY ===

def discover_maps_from_wiki():
    ZONE_URL = "https://wiki.guildwars2.com/wiki/Zone"
    CAT_URL = "https://wiki.guildwars2.com/wiki/Category:Zones"

    html_main = fetch_html(ZONE_URL)
    html_cat  = fetch_html(CAT_URL)

    playable_names = set(re.findall(r'<li>\s*<a [^>]*title="([^"]+)"', html_cat))

    expansion_blocks = []
    for match in re.finditer(r'<h3>([^<]+)</h3>', html_main):
        expansion_blocks.append({ "start": match.start(), "expansion": strip_html(match.group(1)) })

    maps = []
    for match in re.finditer(r'<tr class="line-bottom">([\s\S]*?)</tr>', html_main):
        block = match.group(1)
        m = re.search(r'<a href="(\/wiki\/[^"]+)" title="([^"]+)"', block)
        if not m: continue

        map_link = "https://wiki.guildwars2.com" + m.group(1)
        map_name = m.group(2).strip()
        if map_name not in playable_names:
            continue

        exp = "Core"
        for eb in reversed(expansion_blocks):
            if match.start() > eb["start"]:
                exp = eb["expansion"]
                break

        maps.append({ "expansion": exp, "name": map_name, "url": map_link })
    print(f"🗺️ Found {len(maps)} maps from Zone page")
    return maps

def enrich_maps_with_csv(maps):
    maps_csv = load_csv("data/maps.csv")
    csv_map_index = {row["name"]: row for row in maps_csv}

    enriched = []
    for m in maps:
        csvrow = csv_map_index.get(m["name"])
        if csvrow and csvrow["type"].lower() == "public":
            enriched.append({
                "name": m["name"],
                "slug": to_slug(m["name"]),
                "expansion": m["expansion"],
                "region": csvrow.get("region_name", ""),
                "continent": csvrow.get("continent_name", ""),
                "mapUrl": m["url"]
            })
    print(f"✅ Filtered down to {len(enriched)} playable maps (type=public)")
    return enriched

# === EVENT DISCOVERY ===

def find_events_from_map_page(html):
    soup = BeautifulSoup(html, "html.parser")
    sections = ["Events", "Dynamic_events", "Meta_events", "Objectives", "Hearts"]
    found = []

    for sec in sections:
        span = soup.find("span", id=sec)
        if not span:
            continue
        ul = span.find_next("ul")
        if not ul:
            continue

        for li in ul.find_all("li", recursive=False):
            a = li.find("a", href=True)
            if a and a["href"].startswith("/wiki/Event:"):
                title = a.get("title") or a.text.strip()
                found.append({
                    "title": title,
                    "url": "https://wiki.guildwars2.com" + a["href"],
                    "area": sec
                })

    seen = set()
    return [e for e in found if not (e["title"].lower() in seen or seen.add(e["title"].lower()))]

# === STATIC DATA ===

items = load_csv("data/items.csv")
items_index = {i["name"].lower(): i for i in items}
item_names = list(items_index.keys())

achievements = load_csv("data/achievements.csv")
achievement_ids = set(str(a["id"]) for a in achievements)

drop_rates = {}
print("📥 Loading drop rates from wiki...")
r = requests.get("https://wiki.guildwars2.com/wiki/Special:Ask/mainlabel%3D/limit%3D5000/format%3Dcsv/prettyprint%3Dtrue/unescape%3Dtrue/searchlabel%3DCSV")
if r.ok:
    reader = csv.DictReader(r.text.splitlines())
    for row in reader:
        iid = row.get("itemid") or row.get("item id")
        if iid:
            drop_rates[iid] = row.get("rate", "")

# === ITEM MATCHING + ENRICHING ===

def match_item_to_csv(name):
    clean = name.lower()
    if clean in items_index:
        return items_index[clean]
    result = process.extractOne(clean, item_names, scorer=fuzz.token_sort_ratio)
    if result and result[1] >= 99:
        return items_index[result[0]]
    return None

def enrich_item_from_api(item_id):
    try:
        r = requests.get(f"https://api.guildwars2.com/v2/commerce/prices/{item_id}")
        if r.ok:
            return r.json().get("sells", {}).get("unit_price", 0)
    except: pass
    return 0

# === LOOT PARSING ===

def enrich_loot_item(name, ctx, guaranteed="no"):
    match = match_item_to_csv(name)
    if not match:
        return None

    item_id = str(match["id"])
    rarity = match.get("rarity", "")
    flags  = match.get("flags", "")

    price = enrich_item_from_api(item_id)
    if rarity.lower() in ("junk", "basic"):
        return None
    if price < 3000 and "Collectible" not in (flags or "") and item_id not in achievement_ids:
        return None

    return {
        "Loot": name,
        "Loot ID": item_id,
        "Rarity": rarity,
        "Guaranteed": guaranteed,
        "Collectible": "yes" if "Collectible" in (flags or "") else "no",
        "Accountbound": "yes" if "AccountBound" in (flags or "") else "no",
        "Achievement": "yes" if item_id in achievement_ids else "no",
        "Droprate": drop_rates.get(item_id, "")
    }

def crawl_container_loot(item_url, ctx, depth=0):
    if depth > 2: return []

    html = fetch_html(item_url)
    soup = BeautifulSoup(html, "html.parser")
    results = []

    for ul in soup.find_all("ul"):
        for li in ul.find_all("li", recursive=False):
            a = li.find("a", href=True)
            if not a or not a['href'].startswith("/wiki/"):
                continue
            name = a.get("title") or a.text.strip()
            if not name or "List of" in name:
                continue

            li_text = li.get_text(strip=True).lower()
            guaranteed = "yes" if "guaranteed" in li_text else "no"

            if is_container(name):
                nested_url = "https://wiki.guildwars2.com" + a["href"]
                results += crawl_container_loot(nested_url, ctx, depth + 1)
            else:
                results.append({
                    "name": name,
                    "url": "https://wiki.guildwars2.com" + a["href"],
                    "guaranteed": guaranteed
                })
    return results

def find_reward_list_from_event_page(soup):
    reward_span = soup.find("span", id=lambda x: x and x.lower().startswith("reward"))
    if not reward_span:
        return []
    next_tag = reward_span.parent
    while next_tag:
        next_tag = next_tag.find_next_sibling()
        if not next_tag:
            break
        if next_tag.name == "ul":
            return next_tag.find_all("li")
    return []

def parse_loot_from_event_page(html, ctx):
    soup = BeautifulSoup(html, "html.parser")
    li_tags = find_reward_list_from_event_page(soup)
    loot_items = []

    for li in li_tags:
        name = li.text.split(" (")[0].strip()
        if is_container(name):
            href = li.find("a", href=True)
            url = "https://wiki.guildwars2.com" + href["href"] if href else None
            nested_items = crawl_container_loot(url, ctx)
            for nested in nested_items:
                enriched = enrich_loot_item(nested["name"], ctx, guaranteed=nested.get("guaranteed", "no"))
                if enriched:
                    loot_items.append(enriched)
        else:
            li_text = li.get_text(strip=True).lower()
            guaranteed = "yes" if "guaranteed" in li_text else "no"
            enriched = enrich_loot_item(name, ctx, guaranteed=guaranteed)
            if enriched:
                loot_items.append(enriched)
    return loot_items

# === MAIN ===

def main():
    maps_raw = discover_maps_from_wiki()
    maps = enrich_maps_with_csv(maps_raw)
    manifest = []

    for mp in maps:
        print(f"🌍 {mp['name']}")
        html = fetch_html(mp["mapUrl"])
        events = find_events_from_map_page(html)
        print(f"🔎 Found {len(events)} events")
        if not events:
            print(f"⚠️ No events found for {mp['name']}")
            continue

        event_rows = []
        for ev in tqdm(events, desc=f"  🔎 {mp['name']}"):
            ev_html = fetch_html(ev["url"])
            soup = BeautifulSoup(ev_html, "html.parser")
            desc = first_sentences(soup.find("p").text if soup.find("p") else "")
            location = re.search(r'<dt[^>]*>Location<\/dt>\s*<dd>(.*?)<\/dd>', ev_html, re.I | re.S)
            location = strip_html(location.group(1)) if location else ""
            waypoint = re.search(r'<a href="\/wiki\/[^"]+Waypoint[^"]*"[^>]*>([^<]*Waypoint)<\/a>', ev_html)
            waypoint = waypoint.group(1).strip() if waypoint else ""

            loot = parse_loot_from_event_page(ev_html, mp)
            for item in loot:
                event_rows.append({
                    "Expansion": mp["expansion"],
                    "Region": mp["region"],
                    "Continent": mp["continent"],
                    "Map": mp["name"],
                    "Eventname": ev["title"],
                    "Event description": desc,
                    "Area": ev["area"],
                    "Location": location,
                    "Closest Waypoint": waypoint,
                    **item
                })

        slug = to_slug(mp["name"])
        with open(f"{DATA_DIR}/{slug}.json", "w", encoding="utf-8") as f:
            json.dump(event_rows, f, indent=2, ensure_ascii=False)

        manifest.append({ "map": mp["name"], "slug": slug })
        print(f"✅ {mp['name']}: {len(event_rows)} loot lines written")

    with open("data/manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print("📦 All done.")

if __name__ == "__main__":
    main()
