import os, csv, json, time, requests
from bs4 import BeautifulSoup
from rapidfuzz import fuzz

DATA_DIR = "data/maps"
os.makedirs(DATA_DIR, exist_ok=True)

# === LOAD CSV ===
def load_csv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))

# === UTILS ===
def to_slug(name):
    return (
        name.lower()
        .replace(" ", "_")
        .replace(":", "")
        .replace("'", "")
        .replace("-", "_")
    )

def wiki_link(name):
    return f"https://wiki.guildwars2.com/wiki/Special:Search/{name.replace(' ', '%20')}"

def tp_link(item_id):
    return f"https://gw2efficiency.com/item/{item_id}"

def fetch_html(url):
    time.sleep(0.25)
    for _ in range(3):
        try:
            r = requests.get(url, timeout=15)
            if r.status_code == 200:
                return r.text
        except:
            time.sleep(1)
    return ""

def get_first_sentences(text, n=2):
    s = text.strip().split('. ')
    return '. '.join(s[:n]) + ('. (see wiki)' if len(s) > n else '')

def get_tp_price(item_id):
    try:
        resp = requests.get(f"https://api.guildwars2.com/v2/commerce/prices/{item_id}")
        if resp.status_code != 200: return ("", 0)
        js = resp.json()
        p = js.get("sells", {}).get("unit_price")
        if p is None: return ("", 0)
        return (f"{p//10000}g {(p%10000)//100}s {p%100}c", p)
    except:
        return ("", 0)

# === LOAD DUMPS ===
items = load_csv("data/items.csv")
items_db = {i["name"].lower(): i for i in items}

achievements = load_csv("data/achievements.csv")
ach_item_ids = set()
for a in achievements:
    for r in a.get("rewardItems", "").split(";"):
        if r.strip().isdigit():
            ach_item_ids.add(r.strip())

drop_rates = {}
if os.path.exists("data/drop_rates.csv"):
    for row in load_csv("data/drop_rates.csv"):
        drop_rates[row["item_id"]] = row.get("rate", "")

maps = [m for m in load_csv("data/maps.csv") if m.get("public", "").lower() == "public"]
manifest = []

# === EVENT DISCOVERY ===
def discover_events_from_spans(soup):
    events = []
    for span in soup.select('span[id^="Events"], span[id^="Dynamic_events"], span[id^="Meta_events"]'):
        ul = span.find_next("ul")
        for li in ul.find_all("li") if ul else []:
            a = li.find("a")
            if not a: continue
            href = a.get("href", "")
            if "/wiki/Event:" in href:
                events.append({
                    "title": a.text.strip(),
                    "url": "https://wiki.guildwars2.com" + href
                })
    return events

def discover_events_from_category(map_name):
    url = f"https://wiki.guildwars2.com/wiki/Category:{map_name.replace(' ', '_')}_events"
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")
    events = []
    for a in soup.select("div.mw-category li a"):
        href = a.get("href", "")
        title = a.get("title", "")
        if href and not title.lower().startswith("category:"):
            events.append({
                "title": title.strip(),
                "url": "https://wiki.guildwars2.com" + href
            })
    return events

def discover_events_appscript_fallback(map_url):
    html = fetch_html(map_url)
    soup = BeautifulSoup(html, "html.parser")
    results = []
    for ul in soup.find_all("ul"):
        for li in ul.find_all("li"):
            a = li.find("a")
            if a and a.get("href", "").startswith("/wiki/Event:"):
                results.append({
                    "title": a.text.strip(),
                    "url": "https://wiki.guildwars2.com" + a['href']
                })
    return results

# === MAIN CRAWL ===
for mp in maps:
    map_slug = to_slug(mp.get("name", "???"))
    url = mp.get("mapUrl") or mp.get("wiki") or ""
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    events = discover_events_from_spans(soup)
    if not events:
        events = discover_events_from_category(mp["name"])
    if not events:
        events = discover_events_appscript_fallback(url)

    # === PER EVENT ===
    event_objs = []
    for ev in events:
        event_html = fetch_html(ev["url"])
        esoup = BeautifulSoup(event_html, "html.parser")
        desc = get_first_sentences(esoup.find("p").text if esoup.find("p") else "")
        location = ""
        for dt in esoup.find_all("dt"):
            if "Location" in dt.text:
                dd = dt.find_next("dd")
                location = dd.text.strip() if dd else ""
                break
        wp = (esoup.find("a", href=lambda h: h and "Waypoint" in h) or {}).text.strip() if esoup.find("a", href=lambda h: h and "Waypoint" in h) else ""

        loot = []
        loot_section = esoup.find("span", id=lambda i: i and "Reward" in i)
        if loot_section:
            ul = loot_section.find_next("ul")
            for li in ul.find_all("li") if ul else []:
                name = li.text.split(" (")[0].strip()
                match = items_db.get(name.lower())
                if not match:
                    for k in items_db:
                        if fuzz.ratio(k, name.lower()) > 90:
                            match = items_db[k]; break
                if not match: continue
                item_id = match.get("id", "")
                rarity = match.get("rarity", "")
                tpval, tp_raw = get_tp_price(item_id) if item_id else ("", 0)
                if rarity.lower() in ["junk", "basic"]: continue
                if tp_raw < 3000 and match.get("type", "").lower() != "collectible" and item_id not in ach_item_ids and "guaranteed" not in li.text.lower():
                    continue

                loot.append({
                    "name": name,
                    "item_id": item_id,
                    "rarity": rarity,
                    "guaranteed": "Yes" if "guaranteed" in li.text.lower() else "No",
                    "collectible": "Yes" if match.get("type","").lower() == "collectible" else "No",
                    "account_bound": "Yes" if "AccountBound" in (match.get("flags") or "") else "No",
                    "achievement_linked": "Yes" if item_id in ach_item_ids else "No",
                    "droprate": drop_rates.get(item_id, ""),
                    "tp_value": tpval,
                    "wiki_link": wiki_link(name),
                    "tp_link": tp_link(item_id)
                })

        event_objs.append({
            "event_name": ev["title"],
            "event_wiki": ev["url"],
            "description": desc,
            "area": "", # Option: find area from context if needed
            "location": location,
            "waypoint": wp,
            "loot": loot
        })

    out = {
        "expansion": mp.get("expansion", ""),
        "region": mp.get("region", ""),
        "continent": mp.get("continent", ""),
        "map": mp.get("name", ""),
        "map_id": mp.get("id", ""),
        "map_wiki": url,
        "events": event_objs
    }

    with open(f"{DATA_DIR}/{map_slug}.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    manifest.append({"expansion": out["expansion"], "map": out["map"], "slug": map_slug})

with open("data/manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
