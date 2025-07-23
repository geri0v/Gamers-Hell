import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (GuildWars2-LootCrawler-Test/1.0 github.com/your-repo)"
}

def fetch_html(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 200:
            return r.text
        print(f"❌ Failed to fetch {url} (status {r.status_code})")
    except requests.RequestException as e:
        print(f"❌ Exception during fetch: {e}")
    return ""

def find_events_from_category(map_name):
    events = []
    slug = map_name.replace(" ", "_")
    url = f"https://wiki.guildwars2.com/wiki/Category:{slug}_events"

    html = fetch_html(url)
    if not html:
        print("⚠️ Empty HTML response.")
        return events

    soup = BeautifulSoup(html, "html.parser")

    # Zoek alle .mw-category groepen (event blokken)
    for block in soup.select("div.mw-category div.mw-category-group"):
        for li in block.find_all("li"):
            a = li.find("a", href=True)
            if not a or not a["href"].startswith("/wiki/Event:"):
                continue
            events.append({
                "title": a.get("title") or a.text.strip(),
                "url": "https://wiki.guildwars2.com" + a["href"]
            })

    # Dubbele events vermijden
    seen = set()
    final = [e for e in events if not (e["title"].lower() in seen or seen.add(e["title"].lower()))]

    return final

if __name__ == "__main__":
    # 📍 Map instellen die je wilt testen
    map_name = "Caledon Forest"
    print(f"🔍 Fetching events for: {map_name}")
    result = find_events_from_category(map_name)

    print(f"\n✅ Found {len(result)} events in category for '{map_name}'")
    print("📋 First 10 events:")
    for ev in result[:10]:
        print(f"— {ev['title']}")
