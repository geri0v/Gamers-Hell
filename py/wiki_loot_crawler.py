import os, csv, json, requests, time
from bs4 import BeautifulSoup
from rapidfuzz import process, fuzz

DATA_DIR = "data/maps"
os.makedirs(DATA_DIR, exist_ok=True)

# === Helpers ===

def load_csv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))

def to_slug(name):
    return name.lower().replace(" ", "_").replace(":", "").replace("'", "").replace("-", "_")

def fetch_html(url):
    time.sleep(0.25)
    try:
        r = requests.get(url, timeout=15)
        return r.text if r.status_code == 200 else ""
    except Exception:
        return ""

def first_sentences(text, n=2):
    s = text.strip().split('. ')
    return '. '.join(s[:n]).strip() + ('. (see wiki)' if len(s) > n else '')

def get_tp_price(item_id):
    try:
        r = requests.get(f"https://api.guildwars2.com/v2/commerce/prices/{item_id}")
        if r.status_code != 200: return "", 0
        js = r.json()
        price = js.get("sells", {}).get("unit_price")
        if price is None: return "", 0
        g, s, c = price // 10000, (price % 10000) // 100, price % 100
        return f"{g}g {s}s {c}c", price
    except: return "", 0

def wiki_link(name):
    return f"https://wiki.guildwars2.com/wiki/Special:Search/{name.replace(' ', '%20')}"

# === Load data ===

items = load_csv("data/items.csv")
items_db = {i["name"].lower(): i for i in items}

achievements = load_csv("data/achievements.csv")
ach_ids = set()
for a in achievements:
    for r in a.get("rewardItems", "").split(";"):
        if r.strip().isdigit():
            ach_ids.add(r.strip())

drop_rates = {}
if os.path.exists("data/drop_rates.csv"):
    for row in load_csv("data/drop_rates.csv"):
        drop_rates[row["item_id"]] = row.get("rate", "")

maps = [m for m in load_csv("data/maps.csv") if m.get("type", "").lower() == "public"]
manifest = []

# === Fallback blocks ===

def find_events_by_spans(soup):
    events = []
    for span in soup.select('span[id^="Events"], span[id^="Dynamic_events"], span[id^="Meta_events"]'):
        ul = span.find_next("ul")
        for li in ul.find_all("li") if ul else []:
            a = li.find("a")
            if a and '/wiki/Event:' in a.get("href", ""):
                events.append({"title": a.text.strip(), "url": "https://wiki.guildwars2.com" + a["href"], "area": span.text.strip()})
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
            events.append({"title": title.strip(), "url": "https://wiki.guildwars2.com" + href, "area": "Category"})
    return events

def find_events_fallback(html):
    soup = BeautifulSoup(html, "html.parser")
    events = []
    for a in soup.select("a[href^='/wiki/Event:']"):
        href = a.get("href", "")
        title = a.get("title", "")
        if title:
            events.append({"title": title.strip(), "url": "https://wiki.guildwars2.com" + href, "area": "Fallback"})
    return events

# === Crawl ===

def get_loot_data(loot_html):
    loot = []
    for li in loot_html.find_all("li") if loot_html else []:
        name = li.text.split(" (")[0].strip()
        match = items_db.get(name.lower())
        if match is None:
            choices = list(items_db.keys())
            result = process.extractOne(name.lower(), choices, scorer=fuzz.token_sort_ratio)
            if result and result[1] > 90:
                match = items_db[result[0]]
        if not match: continue
        item_id = match["id"]
        rarity = match["rarity"]
        tp_str, tp_val = get_tp_price(item_id)
        if rarity.lower() in ["junk", "basic"]: continue
        if tp_val < 3000 and match.get("type", "").lower() != "collectible" and item_id not in ach_ids and "guaranteed" not in li.text.lower():
            continue
        loot.append({
            "Loot": name,
            "Loot ID": item_id,
            "Rarity": rarity,
            "Guaranteed": "yes" if "guaranteed" in li.text.lower() else "no",
            "Collectible": "yes" if "Collectible" in (match.get("flags") or "") else "no",
            "Accountbound": "yes" if "AccountBound" in (match.get("flags") or "") else "no",
            "Achievement": "yes" if item_id in ach_ids else "no",
            "Droprate": drop_rates.get(item_id, ""),
        })
    return loot

for mp in maps:
    url = mp.get("mapUrl") or mp.get("wiki") or ""
    print(f"🌍 Map: {mp['name']}")
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")
    events = find_events_by_spans(soup) or find_events_by_category(mp["name"]) or find_events_fallback(html)

    crawled_events = []
    for ev in events:
        ev_html = fetch_html(ev["url"])
        ev_soup = BeautifulSoup(ev_html, "html.parser")
        desc = first_sentences(ev_soup.find("p").text if ev_soup.find("p") else "")
        location = ""
        for dt in ev_soup.find_all("dt"):
            if "Location" in dt.text:
                dd = dt.find_next("dd")
                location = dd.text.strip() if dd else ""
                break
        wp = ev_soup.find("a", href=lambda h: h and "Waypoint" in h)
        waypoint = wp.text.strip() if wp else ""

        loot_block = ev_soup.find("span", id=lambda x: x and "Reward" in x)
        loot = get_loot_data(loot_block.find_next("ul") if loot_block else None)

        for item in loot:
            crawled_events.append({
                "Expansion": mp.get("expansion", ""),
                "Region": mp.get("region", ""),
                "Continent": mp.get("continent", ""),
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
        json.dump(crawled_events, f, ensure_ascii=False, indent=2)

    manifest.append({"map": mp["name"], "slug": slug})

with open("data/manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
