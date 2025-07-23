import os
import csv
import json
import re
import time
import requests
from collections import defaultdict
from bs4 import BeautifulSoup
from rapidfuzz import fuzz, process
from tqdm import tqdm

DATA_DIR = "data/maps"
os.makedirs(DATA_DIR, exist_ok=True)

# === CONFIG ===
SLEEP = 0.15
GW2T_TOKEN = "df70c529-b684-4d81-b882-7e2665de3afe"

def sleep(): time.sleep(SLEEP)

# === UTILS ===

def fetch_html(url):
    sleep()
    try:
        r = requests.get(url, timeout=20)
        if r.status_code == 200:
            return r.text
        print(f"❌ [{r.status_code}] Failed to fetch {url}")
    except Exception as e:
        print(f"❌ EXCEPTION on {url}: {e}")
    return ""

def load_csv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))

def to_slug(name):
    return name.lower().replace(" ", "_").replace(":", "").replace("'", "").replace("-", "_")

# === STEP 1 — Load base maps from wiki via ZONE + CATEGORIE ===

def discover_maps_from_wiki():
    ZONE_URL = "https://wiki.guildwars2.com/wiki/Zone"
    CAT_URL  = "https://wiki.guildwars2.com/wiki/Category:Zones"

    html_main = fetch_html(ZONE_URL)
    html_cat  = fetch_html(CAT_URL)

    playable_names = set()
    cat_titles = re.findall(r'<li>\s*<a [^>]*title="([^"]+)"', html_cat)
    for title in cat_titles:
        playable_names.add(title.strip())

    expansion_blocks = []
    for match in re.finditer(r'<h3>([^<]+)</h3>', html_main):
        expansion_blocks.append({ "start": match.start(), "expansion": strip_html(match.group(1)) })

    maps = []
    for match in re.finditer(r'<tr class="line-bottom">([\s\S]*?)</tr>', html_main):
        block = match.group(1)
        m = re.search(r'<a href="(\/wiki\/[^"]+)" title="([^"]+)"', block)
        if not m:
            continue
        map_link = "https://wiki.guildwars2.com" + m.group(1)
        map_name = m.group(2).strip()

        if map_name not in playable_names:
            continue

        # Vind expansion
        exp = "Core"
        for eb in reversed(expansion_blocks):
            if match.start() > eb["start"]:
                exp = eb["expansion"]
                break

        maps.append({ "expansion": exp, "name": map_name, "url": map_link })

    print(f"🗺️  Found {len(maps)} maps from Zone page (filtered via Category:Zones)")
    return maps

def strip_html(text):
    return re.sub(r"<[^>]+>", "", text or "").strip()

# === STEP 2 — Merge with your own DATA/maps.csv (region, continent, type) ===

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
    print(f"✅ Kept {len(enriched)}/{len(maps)} maps after filtering on type=public from maps.csv")
    return enriched

# === STEP 3 — Event discover via SPAN or CATEGORY fallback ===

def find_events_from_map_page(html):
    events = []
    heads = ["Events", "Dynamic_events", "Meta_events", "Objectives", "Hearts"]
    for h in heads:
        m = re.search(r'<span[^>]*id="' + re.escape(h) + r'"[^>]*>.*?</span>\s*<ul>([\s\S]+?)</ul>', html, re.I)
        if not m:
            continue
        section = m.group(1)
        for a in re.findall(r'<a href="(/wiki/Event:[^"]+)" title="([^"]+)"', section):
            events.append({ "title": a[1], "url": "https://wiki.guildwars2.com" + a[0], "area": h })
    seen = set()
    clean = [ev for ev in events if not (ev["title"].lower() in seen or seen.add(ev["title"].lower()))]
    return clean

def find_events_from_category(map_name):
    url = "https://wiki.guildwars2.com/wiki/Category:" + map_name.replace(" ", "_") + "_events"
    html = fetch_html(url)
    events = []
    for m in re.findall(r'<a href="(/wiki/Event:[^"]+)" title="([^"]+)"', html):
        events.append({
            "url": "https://wiki.guildwars2.com" + m[0],
            "title": m[1].strip(),
            "area": "Category"
        })
    return events

# === STEP 4 — Load all static data ===

items = load_csv("data/items.csv")
items_index = {i["name"].lower(): i for i in items}
item_names = list(items_index.keys())

achievements = load_csv("data/achievements.csv")
achievement_ids = set(str(a["id"]) for a in achievements)

# LIVE drop rate
drop_rates = {}
print("📥 Loading drop rates from wiki...")
r = requests.get("https://wiki.guildwars2.com/wiki/Special:Ask/mainlabel%3D/limit%3D5000/format%3Dcsv/prettyprint%3Dtrue/unescape%3Dtrue/searchlabel%3DCSV")
if r.ok:
    reader = csv.DictReader(r.text.splitlines())
    for row in reader:
        iid = row.get("itemid") or row.get("item id")
        if iid:
            drop_rates[iid] = row.get("rate", "")

# === STEP 5 — Extract drop/loot from event wiki ===

def first_sentences(text, n=2):
    sentences = text.strip().split('. ')
    return '. '.join(sentences[:n]) + ('. (see wiki)' if len(sentences) > n else '')

def parse_location_from_html(html):
    m = re.search(r'<dt[^>]*>Location<\/dt>\s*<dd>(.*?)<\/dd>', html, re.I | re.S)
    return strip_html(m.group(1)) if m else ""

def parse_waypoint_from_html(html):
    m = re.search(r'<a href="\/wiki\/[^"]+Waypoint[^"]*"[^>]*>([^<]*Waypoint)<\/a>', html)
    return m.group(1).strip() if m else ""

# === Matching ===

def match_item_to_csv(name):
    clean = name.lower()
    if clean in items_index:
        return items_index[clean]
    result = process.extractOne(clean, item_names, scorer=fuzz.token_sort_ratio)
    if result and result[1] >= 99:
        return items_index[result[0]]
    return None

def enrich_item_from_api(item_id):
    # Trading Post price
    tp_url = f"https://api.guildwars2.com/v2/commerce/prices/{item_id}"
    price = 0
    try:
        r = requests.get(tp_url)
        if r.ok:
            js = r.json()
            price = js.get("sells", {}).get("unit_price", 0)
    except: pass
    return price

def enrich_item_from_gw2treasures(name):
    try:
        url = f"https://api.gw2treasures.com/items?name={name}"
        headers = {"Authorization": f"Bearer {GW2T_TOKEN}"}
        r = requests.get(url, headers=headers)
        res = r.json()
        return res[0] if res else None
    except:
        return None

def is_container(name):
    return re.search(r'chest|bag|cache|container|satchel|box|reward|sack', name, re.I)

# === RECURSIVE LOOT CRASHER ===

def crawl_container_loot(item_page_url, ctx, depth=0):
    if depth > 2:
        return []
    html = fetch_html(item_page_url)
    uls = re.findall(r'<ul>([\s\S]*?)</ul>', html)
    items = []
    for ul in uls:
        for m in re.findall(r'<a href="(/wiki/[^"]+)" title="([^"]+)"', ul):
            href, name = m
            items.append({ "name": name, "url": "https://wiki.guildwars2.com" + href })
            # nested container? Recursief
            if is_container(name):
                items += crawl_container_loot("https://wiki.guildwars2.com" + href, ctx, depth+1)
    return items

def parse_loot_from_event_page(html, ctx):
    soup = BeautifulSoup(html, "html.parser")
    span = soup.find("span", id=lambda x: x and "Reward" in x)
    ul = span.find_next("ul") if span else None
    if not ul:
        return []

    loot_items = []
    li_tags = ul.find_all("li") if ul else []

    for li in li_tags:
        name = li.text.split(" (")[0].strip()
        if is_container(name):
            match = re.search(r'<a href="(/wiki/[^"]+)"', str(li), re.I)
            url = "https://wiki.guildwars2.com" + match.group(1) if match else ""
            nested = crawl_container_loot(url, ctx)
            for sub in nested:
                loot_items.append(enrich_loot_item(sub["name"], ctx))
        else:
            loot_items.append(enrich_loot_item(name, ctx))

    return [i for i in loot_items if i]

def enrich_loot_item(name, ctx):
    match = match_item_to_csv(name)
    if not match:
        return None

    item_id = str(match["id"])
    rarity = match.get("rarity", "")
    flags  = match.get("flags", "")
    price = enrich_item_from_api(item_id)

    # Filtering rarity only AFTER container parsed
    if rarity.lower() in ("junk", "basic"):
        return None

    if price < 3000 and "Collectible" not in (flags or "") and item_id not in achievement_ids:
        return None

    return {
        "Loot": name,
        "Loot ID": item_id,
        "Rarity": rarity,
        "Guaranteed": "yes" if "guaranteed" in name.lower() else "no",
        "Collectible": "yes" if "Collectible" in (flags or "") else "no",
        "Accountbound": "yes" if "AccountBound" in (flags or "") else "no",
        "Achievement": "yes" if item_id in achievement_ids else "no",
        "Droprate": drop_rates.get(item_id, "")
    }

# === STEP 6 — MAIN EXECUTION ===

def main():
    maps_raw = discover_maps_from_wiki()
    maps = enrich_maps_with_csv(maps_raw)
    manifest = []

    for mp in maps:
        print(f"🌍 {mp['name']}")
        html = fetch_html(mp["mapUrl"])
        events = find_events_from_map_page(html)
        if not events:
            events = find_events_from_category(mp["name"])
        if not events:
            print(f"⚠️  No events found for {mp['name']}")
            continue

        event_rows = []
        for ev in tqdm(events, desc=f"  🔎 {mp['name']}"):
            ev_html = fetch_html(ev["url"])
            soup = BeautifulSoup(ev_html, "html.parser")
            desc = first_sentences(soup.find("p").text if soup.find("p") else "")
            location = parse_location_from_html(ev_html)
            waypoint = parse_waypoint_from_html(ev_html)

            loot = parse_loot_from_event_page(ev_html, mp)

            for l in loot:
                row = {
                    "Expansion": mp["expansion"],
                    "Region": mp["region"],
                    "Continent": mp["continent"],
                    "Map": mp["name"],
                    "Eventname": ev["title"],
                    "Event description": desc,
                    "Area": ev["area"],
                    "Location": location,
                    "Closest Waypoint": waypoint,
                    **l
                }
                event_rows.append(row)

        # Write to file
        slug = to_slug(mp["name"])
        with open(f"{DATA_DIR}/{slug}.json", "w", encoding="utf-8") as f:
            json.dump(event_rows, f, indent=2, ensure_ascii=False)

        manifest.append({ "map": mp["name"], "slug": slug })
        print(f"✅ {mp['name']}: {len(event_rows)} loot lines written")

    # Save manifest
    with open("data/manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print("📦 All done.")

if __name__ == "__main__":
    main()
