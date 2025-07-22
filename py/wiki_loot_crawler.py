import os, csv, json, time, requests
from bs4 import BeautifulSoup
from rapidfuzz import fuzz

DATA_DIR = "data/maps"
os.makedirs(DATA_DIR, exist_ok=True)

# Utility– functies
def load_csv(path):
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)

def to_slug(name):
    return name.lower().replace(" ", "_").replace("'", "").replace("-", "_")

def fetch_html(url):
    for _ in range(3):
        try:
            r = requests.get(url, timeout=20)
            if r.status_code == 200:
                return r.text
        except Exception:
            time.sleep(1)
    return ""

def get_first_sentences(txt, n=2):
    s = txt.strip().split('. ')
    return '. '.join(s[:n]) + ('. (see wiki)' if len(s) > n else '')

# Enrichment helpers
def get_tp_price(item_id):
    try:
        url = f"https://api.guildwars2.com/v2/commerce/prices/{item_id}"
        r = requests.get(url)
        if r.status_code != 200:
            return ""
        js = r.json()
        price = js.get("sells", {}).get("unit_price")
        if price is None: return ""
        g, s, c = price//10000, (price%10000)//100, price%100
        return f"{g}g {s}s {c}c"
    except Exception:
        return ""

def wiki_link(item_name):
    return f"https://wiki.guildwars2.com/wiki/Special:Search/{item_name.replace(' ', '%20')}"

def tp_link(item_id):
    return f"https://gw2efficiency.com/item/{item_id}"

# Laad dumps
items_db = {i["name"].lower(): i for i in load_csv("data/items.csv")}
ach_db = set()
for a in load_csv("data/achievements.csv"):
    for r in (a.get("rewardItems", "") or "").split(';'):
        if r.strip().isdigit():
            ach_db.add(r.strip())

maps = load_csv("data/maps.csv")
manifest = []

# Main loop
for mp in maps:
    map_slug = to_slug(mp["name"])
    url = mp.get("mapUrl") or mp.get("wiki") or ""
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    events_list = []
    for sec in soup.find_all("span", id=lambda x: x and ("Events" in x or "Meta" in x)):
        ul = sec.find_next("ul")
        for li in ul.find_all("li") if ul else []:
            a = li.find("a")
            if not a: continue
            eurl = "https://wiki.guildwars2.com" + a.get('href')
            event_html = fetch_html(eurl)
            esoup = BeautifulSoup(event_html, "html.parser")
            desc = esoup.find("p")
            desc_txt = get_first_sentences(desc.text if desc else "", 2)
            loc = ""
            for dt in esoup.find_all("dt"):
                if "Location" in dt.text:
                    dd = dt.find_next("dd")
                    loc = dd.text.strip() if dd else ""
                    break
            wp_match = esoup.find("a", href=lambda h: h and "Waypoint" in h)
            waypoint = wp_match.text.strip() if wp_match else ""

            loot_block = esoup.find("span", id="Rewards")
            loot = []
            if loot_block:
                ul2 = loot_block.find_next("ul")
                for itm in ul2.find_all("li") if ul2 else []:
                    name = itm.text.split("(")[0].strip()
                    match = items_db.get(name.lower())
                    if not match:
                        # Fuzzy fallback, mag aangepast (rapidfuzz)
                        found = None
                        for k in items_db:
                            if fuzz.ratio(k, name.lower()) > 90:
                                found = items_db[k]
                                break
                        match = found or {}
                    item_id = match.get("id", "")
                    rarity = match.get("rarity", "")
                    collectible = "yes" if match.get("type","").lower() == "collectible" else "no"
                    accountbound = "yes" if "AccountBound" in (match.get("flags") or "") else "no"
                    achiev = "yes" if item_id in ach_db else "no"
                    drop_rate = "" # Koppel hier drop_rates.csv/droprateproject als nodig!
                    tpval = get_tp_price(item_id) if item_id else ""
                    loot.append({
                        "name": name,
                        "item_id": item_id or "",
                        "rarity": rarity,
                        "guaranteed": "yes" if "guaranteed" in itm.text.lower() else "no",
                        "collectible": collectible,
                        "accountbound": accountbound,
                        "achievement": achiev,
                        "droprate": drop_rate,
                        "tp_value": tpval,
                        "wiki_link": wiki_link(name),
                        "tp_link": tp_link(item_id) if item_id else ""
                    })

            events_list.append({
                "name": a.text.strip(),
                "wiki": eurl,
                "description": desc_txt,
                "area": sec.text.strip(),
                "location": loc,
                "waypoint": waypoint,
                "loot": loot
            })
    out = {
        "expansion": mp.get("expansion", ""),
        "region": mp.get("region", ""),
        "continent": mp.get("continent", ""),
        "map": mp.get("name", ""),
        "map_id": mp.get("id", ""),
        "map_wiki": url,
        "events": events_list
    }
    with open(f"{DATA_DIR}/{map_slug}.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    manifest.append({"expansion": out["expansion"], "map": out["map"], "slug": map_slug})

with open("data/manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
