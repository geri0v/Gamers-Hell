import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (GW2-Wiki-EventTester/1.0)"
}

def fetch_html(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        if r.status_code == 200:
            return r.text
        print(f"❌ Request failed [{r.status_code}] for {url}")
    except requests.RequestException as e:
        print(f"❌ Network error: {e}")
    return ""

def find_events_from_category(map_name):
    events = []
    seen = set()
    page = 1
    base_slug = map_name.replace(" ", "_")
    base_url = f"https://wiki.guildwars2.com/wiki/Category:{base_slug}_events"

    while True:
        url = base_url + f"?pagefrom={page}" if page > 1 else base_url
        print(f"🔄 Fetching: {url}")
        html = fetch_html(url)
        if not html:
            break

        soup = BeautifulSoup(html, "html.parser")
        blocks = soup.select("div.mw-category-group")

        found_on_page = 0
        for block in blocks:
            for li in block.select("li"):
                a = li.find("a", href=True)
                if not a or not a["href"].startswith("/wiki/Event:"):
                    continue
                title = a.get("title") or a.text.strip()
                if title.lower() in seen:
                    continue
                events.append({
                    "title": title,
                    "url": "https://wiki.guildwars2.com" + a["href"]
                })
                seen.add(title.lower())
                found_on_page += 1

        if found_on_page == 0:
            break  # no more entries; end

        # Note: true MediaWiki paginering is via 'next page' links, kan dynamisch zijn
        # dus we stoppen als er niks nieuws is opgehaald
        page += 1

    return events

if __name__ == "__main__":
    map_name = "Caledon Forest"
    print(f"🔎 Testing category events for: {map_name}")
    events = find_events_from_category(map_name)
    print(f"\n✅ Total events found: {len(events)}")

    for ev in events[:10]:
        print("•", ev['title'])
