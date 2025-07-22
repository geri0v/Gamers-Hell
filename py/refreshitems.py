import requests, csv, time, os
API_URL = "https://api.guildwars2.com/v2/items"
OUTFILE = "data/items.csv"
FIELDS = ["id", "name", "type", "level", "rarity", "vendor_value"]
BATCH_SIZE = 200

os.makedirs("data", exist_ok=True)
def get_chunk(ids): return requests.get(f"{API_URL}?ids={','.join(map(str,ids))}").json()
def write_csv(rows): 
    with open(OUTFILE,'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=FIELDS); w.writeheader()
        for r in rows: w.writerow({k:r.get(k,"") for k in FIELDS})

ids = requests.get(API_URL).json()
items = []
for i in range(0, len(ids), BATCH_SIZE):
    items.extend(get_chunk(ids[i:i+BATCH_SIZE]))
    time.sleep(0.2)
items = [it for it in items if it.get("name")]
write_csv(items)
