# gw2_event_loot_crawler.py

import os
import csv
import json
import time
import requests
from rapidfuzz import process, fuzz
from bs4 import BeautifulSoup
from typing import List

DATA_DIR = "data/maps"
os.makedirs(DATA_DIR, exist_ok=True)

# === LOAD DATA ===

def load_csv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))

items = load_csv("data/items.csv")
achievements = load_csv("data/achievements.csv")
maps = [m for m in load_csv("data/maps.csv") if m.get("type", "").lower() == "public"]

item_db = {i["name"].lower(): i for i in items}
item_id_db = {i["id"]: i for i in items}
ach_ids = set(str(a["id"]).strip() for a in achievements)

drop_rates = {}
try:
    r = requests.get("https://wiki.guildwars2.com/wiki/Special:Ask/mainlabel%3D/limit%3D5000/format%3Dcsv/prettyprint%3Dtrue/unescape%3Dtrue/searchlabel%3DCSV")
    if r.ok:
        reader = csv.DictReader(r.text.splitlines())
        for row in reader:
            drop_rates[row.get("itemid")] = row.get("rate", "")
except Exception:
    print("⚠️ Failed to load drop rates.")

# === UTILS & HELPERS ===

def to_slug(name): return name.lower().replace(" ", "_").replace("'", "").replace(":", "").replace("-", "_")
def fetch_html(url): time.sleep(0.2); return requests.get(url).text
def wiki_link(name): return f"https://wiki.guildwars2.com/wiki/Special:Search/{name.replace(' ', '%20')}"
def first_sentences(text, n=2):
    s = text.strip().split('. ')
    return '. '.join(s[:n]) + ('. (see wiki)' if len(s) > n else '')

def get_tp_price(item_id: str):
    try:
        res = requests.get(f"https://api.guildwars2.com/v2/commerce/prices/{item_id}")
        if res.ok:
            price = res.json().get("sells", {}).get("unit_price", 0)
            g, s, c = price // 10000, (price % 10000)//100, price % 100
            return f"{g}g {s}s {c}c", price
    except: pass
    return "", 0

def fetch_item_info_api(name):
    try:
        url = f"https://api.guildwars2.com/v2/items?ids=all"
        res = requests.get(url)
        if res.ok:
            for item in res.json():
                if fuzz.token_sort_ratio(name.lower(), item["name"].lower()) >= 99:
                    return item
    except Exception as e:
        print(f"API lookup failed for '{name}': {e}")
    return None

# === EVENT/LOOT CRAWL LOGIC ===

def get_loot_block_html(soup):
    block = soup.find("span", id=lambda x: x and "Reward" in x)
    return block.find_next("ul") if block else None

def get_loot_data(loot_html, event_page_text) -> List[dict]:
    loot_list = []

    for li in loot_html.find_all("li") if loot_html else []:
        raw_name = li.text.split(" (")[0].strip()
        match = item_db.get(raw_name.lower())

        # Fuzzy fallback lookup
        if not match:
            keys = list(item_db.keys())
            result, score = process.extractOne(raw_name.lower(), keys, scorer=fuzz.token_sort_ratio)
            if result and score >= 99:
                match = item_db[result]

        # API last resort
        if not match:
            live = fetch_item_info_api(raw_name)
            if live:
                match = {
                    "id": live["id"],
                    "name": live["name"],
                    "rarity": live.get("rarity", ""),
                    "type": live.get("type", ""),
                    "flags": ','.join(live.get("flags", []))
                }

        if not match: continue

        item_id = str(match["id"])
        rarity = match.get("rarity", "")
        flags = match.get("flags", "")
        tp_str, tp_val = get_tp_price(item_id)

        # filters
        if rarity.lower() in ("junk", "basic"): continue
        if tp_val < 3000 and "Collectible" not in flags and item_id not in ach_ids and "guaranteed" not in li.text.lower():
            continue

        loot_list.append({
            "Loot": raw_name,
            "Loot ID": item_id,
            "Rarity": rarity,
            "Guaranteed": "yes" if "guaranteed" in li.text.lower() else "no",
            "Collectible": "yes" if "Collectible" in flags else "no",
            "Accountbound": "yes" if "AccountBound" in flags else "no",
            "Achievement": "yes" if item_id in ach_ids else "no",
            "Droprate": drop_rates.get(item_id, "")
        })

    return loot_list
# --- Deel 2 van gw2_event_loot_crawler.py ---

def find_events_by_spans(soup):
    events = []
    for span in soup.select('span[id^="Events"], span[id^="Dynamic_events"], span[id^="Meta_events"]'):
        ul = span.find_next("ul")
        if not ul:
            continue
        for li in ul.find_all("li"):
            a = li.find("a")
            if a and '/wiki/Event:' in a.get("href", ""):
                events.append({
                    "title": a.text.strip(),
                    "url": "https://wiki.guildwars2.com" + a["href"],
                    "area": span.text.strip()
                })
    return events

def find_events_by_category(map_name):
    url = f"https://wiki.guildwars2.com/wiki/Category:{map_name.replace(' ', '_')}_events"
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")
    events = []
    for a in soup.select(".mw-category li a"):
        href = a.get("href", "")
        title = a.get("title", "")
        if "/wiki/Event:" in href:
            events.append({
                "title": title.strip(),
                "url": "https://wiki.guildwars2.com" + href,
                "area": "Category"
            })
    return events

def find_events_fallback(html):
    soup = BeautifulSoup(html, "html.parser")
    events = []
    for a in soup.select("a[href^='/wiki/Event:']"):
        href = a.get("href", "")
        title = a.get("title", "")
        if title:
            events.append({
                "title": title.strip(),
                "url": "https://wiki.guildwars2.com" + href,
                "area": "Fallback"
            })
    return events

def parse_location_from_html(soup):
    location = ""
    for dt in soup.find_all("dt"):
        if "Location" in dt.text:
            dd = dt.find_next("dd")
            if dd:
                location = dd.text.strip()
            break
    return location

def parse_closest_waypoint_from_html(soup):
    wp = soup.find("a", href=lambda h: h and "Waypoint" in h)
    return wp.text.strip() if wp else ""

def crawl_events_for_map(mp):
    url = mp.get("mapUrl") or mp.get("wiki") or f"https://wiki.guildwars2.com/wiki/{mp['name'].replace(' ', '_')}"
    print(f"🌍 Crawling map: {mp['name']} ({mp.get('region_name','')} / {mp.get('continent_name','')})")
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")
    events = find_events_by_spans(soup) or find_events_by_category(mp["name"]) or find_events_fallback(html)

    crawled_events = []
    for ev in events:
        ev_html = fetch_html(ev["url"])
        ev_soup = BeautifulSoup(ev_html, "html.parser")
        desc_p = ev_soup.find("p")
        desc = first_sentences(desc_p.text if desc_p else "")
        location = parse_location_from_html(ev_soup)
        waypoint = parse_closest_waypoint_from_html(ev_soup)

        loot_block = ev_soup.find("span", id=lambda x: x and "Reward" in x)
        loot_ul = loot_block.find_next("ul") if loot_block else None
        loot = get_loot_data(loot_ul, ev_html)

        for item in loot:
            crawled_events.append({
                "Expansion": mp.get("expansion", ""),
                "Region": mp.get("region_name", ""),
                "Continent": mp.get("continent_name", ""),
                "Map": mp["name"],
                "Eventname": ev["title"],
                "Event description": desc,
                "Area": ev["area"],
                "Location": location,
                "Closest Waypoint": waypoint,
                **item
            })
    return crawled_events

def main():
    manifest = []
    for mp in maps:
        map_slug = to_slug(mp["name"])
        map_events_loot = crawl_events_for_map(mp)
        if map_events_loot:
            with open(f"{DATA_DIR}/{map_slug}.json", "w", encoding="utf-8") as f:
                json.dump(map_events_loot, f, ensure_ascii=False, indent=2)
            print(f"🚀 Saved data/maps/{map_slug}.json with {len(map_events_loot)} loot entries")
        else:
            print(f"⚠️ No loot found for map: {mp['name']}")
        manifest.append({"map": mp["name"], "slug": map_slug})
    with open("data/manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"✅ Manifest saved with {len(manifest)} maps")

if __name__ == "__main__":
    main()
