import requests
from bs4 import BeautifulSoup

def fetch_html(url):
    r = requests.get(url, timeout=10)
    if r.status_code == 200:
        return r.text
    print(f"Failed to fetch {url}")
    return ""

def find_events_from_category(map_name):
    url = f"https://wiki.guildwars2.com/wiki/Category:{map_name.replace(' ', '_')}_events"
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")
    events = []

    # Zoek alle li’s in de categorielijst
    for li in soup.select(".mw-category li"):
        a = li.find("a", href=True)
        if not a or not a["href"].startswith("/wiki/Event:"):
            continue
        events.append({
            "url": "https://wiki.guildwars2.com" + a["href"],
            "title": a.get("title") or a.text.strip()
        })

    return events

# TEST: werkt dit?
if __name__ == "__main__":
    result = find_events_from_category("Caledon Forest")
    print(f"✅ Found {len(result)} events from category")
    for ev in result[:5]:
        print(f"- {ev['title']}")
