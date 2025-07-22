import requests, csv, time, os
API_URL = "https://api.guildwars2.com/v2/commerce/prices"
OUTFILE = "data/prices.csv"
FIELDS = ["id", "buys.unit_price", "buys.quantity", "sells.unit_price", "sells.quantity"]
BATCH_SIZE = 200

os.makedirs("data", exist_ok=True)
def get_chunk(ids): return requests.get(f"{API_URL}?ids={','.join(map(str,ids))}").json()
def write_csv(rows):
    with open(OUTFILE,'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=FIELDS); w.writeheader()
        for r in rows:
            flat = {k: r.get(k.split(".")[0], {}).get(k.split(".")[1], "") if "." in k else r.get(k,"") for k in FIELDS}
            w.writerow(flat)

# Gebruik alleen de IDs die je in je items.csv tegenkomt!
ids = requests.get("https://api.guildwars2.com/v2/items").json()
rows = []
for i in range(0, len(ids), BATCH_SIZE):
    chunk = get_chunk(ids[i:i+BATCH_SIZE])
    rows.extend(chunk)
    time.sleep(0.2)
write_csv(rows)
