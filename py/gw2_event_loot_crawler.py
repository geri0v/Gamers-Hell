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
