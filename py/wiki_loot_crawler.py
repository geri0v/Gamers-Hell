import os, csv, json, time, requests
from bs4 import BeautifulSoup
from rapidfuzz import fuzz

DATA_DIR = "data/maps"
os.makedirs(DATA_DIR, exist_ok=True)

# === UTILITIES ===

def load_csv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))

def to_slug(name):
    return name.lower().replace(" ", "_").replace("'", "").replace("-", "_")

def fetch_html(url):
    for _ in range(3):
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                return resp.text
        except Exception:
            time.sleep(1)
    return ""

def get_first_sentences(text, n=2):
    s = text.strip().split('. ')
    return '. '.join(s[:n]) + ('. (see wiki)' if len(s) > n else '')

def get_tp_price(item_id):
    try:
        url = f"https://api.guildwars2.com/v2/commerce/prices/{item_id}"
        r = requests.get(url)
        if r.status_code != 200:
            return "", 0
        js = r.json()
        price = js.get("sells", {}).get("unit_price")
        if price is None: return "", 0
        g, s, c = price//10000, (price%10000)//100, price%100
        coin_str = f"{g}g {s}s {c}c"
        return coin_str, price
    except:
        return "", 0

def wiki_link(name):
    return f"https://wiki.guildwars2.com/wiki/Special:Search/{name.replace(' ', '%20')}"

def tp_link(item_id):
    return f"https://gw2efficiency.com/item/{item_id}"

# === LOAD DUMPS ===

items = load_csv("data/items.csv")
items_db = {i["name"].lower(): i for i in items}

achievements = load_csv("data/achievements.csv")
ach_item_ids = set()
for ach in achievements:
    rewards = ach.get("rewardItems", "") or ""
    for rid in rewards.split(';'):
        if rid.strip().isdigit():
            ach_item_ids.add(rid.strip())

# Optional drop rate:
drop_rates = {}
if os.path.exists("data/drop_rates.csv"):
    for row in load_csv("data/drop_rates.csv"):
        drop_rates[row["item_id"]] = row.get("rate", "") or ""

maps = load_csv("data/maps.csv")
manifest = []

# === MAIN LOOP ===

for mp in maps:
    map_slug = to_slug(mp["name"])
    url = mp.get("mapUrl") or mp.get("wiki") or ""
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    events = []

    for span in soup.find_all("span", id=lambda i: i and "vent" in i):
        ul = span.find_next("ul")
        for li in ul.find_all("li") if ul else []:
            a = li.find("a")
            if not a: continue
            eurl = "https://wiki.guildwars2.com" + a.get("href")
            event_html = fetch_html(eurl)
            esoup = BeautifulSoup(event_html, "html.parser")
            para = esoup.find("p")
            desc = get_first_sentences(para.text if para else "", 2)

            location = ""
            for dt in esoup.find_all("dt"):
                if "Location" in dt.text:
                    dd = dt.find_next("dd")
                    location = dd.text.strip() if dd else ""
                    break

            wp_el = esoup.find("a", href=lambda h: h and "Waypoint" in h)
            waypoint = wp_el.text.strip() if wp_el else ""

            loot_block = esoup.find("span", id=lambda i: i and "Reward" in i)
            loot = []

            if loot_block:
                ul2 = loot_block.find_next("ul")
                for itm in ul2.find_all("li") if ul2 else []:
                    name = itm.text.split(" (")[0].strip()
                    match = items_db.get(name.lower())
                    if not match:
                        # fuzzy fallback
                        found = None
                        for k in items_db:
                            if fuzz.ratio(k, name.lower()) > 90:
                                found = items_db[k]
                                break
                        match = found or {}

                    item_id = match.get("id", "")
                    rarity = match.get("rarity", "")
                    collectible = "Yes" if match.get("type", "").lower() == "collectible" else "No"
                    accountbound = "Yes" if "AccountBound" in (match.get("flags") or "") else "No"
                    achievement = "Yes" if item_id and item_id in ach_item_ids else "No"
                    droprate = drop_rates.get(item_id, "")
                    tpval_str, tpval_raw = get_tp_price(item_id) if item_id else ("", 0)
                    guaranteed = "Yes" if "guaranteed" in itm.text.lower() else "No"

                    # === FILTERING: skip unwanted items
                    if not item_id or rarity.lower() in ["junk", "basic"]:
                        continue
                    if tpval_raw < 3000 and collectible != "Yes" and achievement != "Yes" and guaranteed != "Yes":
                        continue

                    loot.append({
                        "name": name,
                        "item_id": item_id,
                        "rarity": rarity,
                        "guaranteed": guaranteed,
                        "collectible": collectible,
                        "account_bound": accountbound,
                        "achievement_linked": achievement,
                        "droprate": droprate,
                        "tp_value": tpval_str,
                        "wiki_link": wiki_link(name),
                        "tp_link": tp_link(item_id)
                    })

            events.append({
                "event_name": a.text.strip(),
                "event_wiki": eurl,
                "description": desc,
                "area": span.text,
                "location": location,
                "waypoint": waypoint,
                "loot": loot
            })

    map_data = {
        "expansion": mp.get("expansion", ""),
        "region": mp.get("region", ""),
        "continent": mp.get("continent", ""),
        "map": mp.get("name", ""),
        "map_id": mp.get("id", ""),
        "map_wiki": url,
        "events": events
    }

    with open(f"{DATA_DIR}/{map_slug}.json", "w", encoding="utf-8") as f:
        json.dump(map_data, f, ensure_ascii=False, indent=2)

    manifest.append({
        "expansion": map_data["expansion"],
        "map": map_data["map"],
        "slug": map_slug
    })

with open("data/manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
