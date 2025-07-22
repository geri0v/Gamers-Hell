import requests, csv, time, os

API_URL = "https://api.guildwars2.com/v2/commerce/prices"
OUTFILE = "data/prices.csv"
FIELDS = ["id", "buys.unit_price", "buys.quantity", "sells.unit_price", "sells.quantity"]
BATCH_SIZE = 200

os.makedirs("data", exist_ok=True)

def get_chunk(ids):
    try:
        resp = requests.get(f"{API_URL}?ids={','.join(map(str, ids))}")
        resp.raise_for_status()
        data = resp.json()
        # Soms is het resultaat een foutmelding (string/dict), controleer of het een echte lijst is
        if isinstance(data, list):
            return [r for r in data if isinstance(r, dict)]  # Extra bescherming
        else:
            print("⚠️ Geen geldige lijst ontvangen:", data)
            return []
    except Exception as e:
        print(f"❌ API-fout in batch: {e}")
        return []

def write_csv(rows):
    with open(OUTFILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()

        for r in rows:
            # Alleen verwerken als r inderdaad een dict is
            if not isinstance(r, dict):
                continue
            flat = {
                "id": r.get("id", ""),
                "buys.unit_price": r.get("buys", {}).get("unit_price", ""),
                "buys.quantity":   r.get("buys", {}).get("quantity", ""),
                "sells.unit_price": r.get("sells", {}).get("unit_price", ""),
                "sells.quantity":   r.get("sells", {}).get("quantity", "")
            }
            writer.writerow(flat)

# Stap 1: ophalen van geldige item IDs
item_ids = requests.get("https://api.guildwars2.com/v2/items").json()
rows = []

# Stap 2: ophalen van prijsinformatie in batches
for i in range(0, len(item_ids), BATCH_SIZE):
    batch = get_chunk(item_ids[i:i+BATCH_SIZE])
    if batch:
        rows.extend(batch)
    time.sleep(0.2)  # Rate limit respecteren

# Stap 3: schrijven naar CSV-bestand
write_csv(rows)

print(f"✅ {len(rows)} prijsregels opgeslagen in {OUTFILE}")
