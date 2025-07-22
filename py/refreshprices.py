import requests, csv, time, os

API_URL = "https://api.guildwars2.com/v2/commerce/prices"
OUTFILE = "data/prices.csv"
FIELDS = ["id", "buys.unit_price", "buys.quantity", "sells.unit_price", "sells.quantity"]
BATCH_SIZE = 200

os.makedirs("data", exist_ok=True)

def get_chunk(ids):
    try:
        resp = requests.get(f"{API_URL}?ids={','.join(map(str,ids))}")
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and "text" in data:
            print("⚠️ API response error message:", data["text"])
            return []
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"❌ Fout in batch: {e}")
        return []

def write_csv(rows):
    with open(OUTFILE, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            # Data uit geneste velden extraheren
            flat = {
                "id": r.get("id", ""),
                "buys.unit_price": r.get("buys", {}).get("unit_price", ""),
                "buys.quantity":    r.get("buys", {}).get("quantity", ""),
                "sells.unit_price": r.get("sells", {}).get("unit_price", ""),
                "sells.quantity":   r.get("sells", {}).get("quantity", "")
            }
            w.writerow(flat)

# IDs ophalen van alle items
item_ids = requests.get("https://api.guildwars2.com/v2/items").json()

rows = []
for i in range(0, len(item_ids), BATCH_SIZE):
    chunk = get_chunk(item_ids[i:i+BATCH_SIZE])
    if chunk:
        rows.extend(chunk)
    time.sleep(0.2)

write_csv(rows)
print(f"✅ {len(rows)} prijsregels weggeschreven naar {OUTFILE}")
