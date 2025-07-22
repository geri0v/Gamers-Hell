import requests
import csv
import time

API_URL = "https://api.guildwars2.com/v2/items"
OUTFILE = "items.csv"
FIELDS = ["id", "name", "type", "level", "rarity", "vendor_value"]
BATCH_SIZE = 200

def get_item_data(item_ids):
    item_ids_str = ",".join(map(str, item_ids))
    url = f"{API_URL}?ids={item_ids_str}"
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Batch ophalen mislukt: {e}")
        return []

def write_to_csv(data):
    with open(OUTFILE, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=FIELDS)
        writer.writeheader()
        for item in data:
            row = {field: item.get(field, "") for field in FIELDS}
            writer.writerow(row)

def main():
    start_time = time.time()

    print("🌐 Ophalen van item-ID's uit API...")
    try:
        res = requests.get(API_URL)
        res.raise_for_status()
        item_ids = res.json()
        print(f"📦 Totaal items gevonden: {len(item_ids)}")
    except Exception as e:
        print(f"❌ Fout bij ophalen van item IDs: {e}")
        return

    items = []
    for i in range(0, len(item_ids), BATCH_SIZE):
        batch_ids = item_ids[i:i+BATCH_SIZE]
        print(f"🔁 Batch {i}–{i+len(batch_ids)}")
        batch_data = get_item_data(batch_ids)
        if batch_data:
            items.extend(batch_data)
        else:
            print("⚠️ Lege batch ontvangen.")
        time.sleep(0.2)  # respecteer API rate-limiet

    # Alleen items met naam
    valid_items = [item for item in items if item.get("name")]
    print(f"📝 Schrijven van {len(valid_items)} geldige items naar CSV...")
    write_to_csv(valid_items)

    print(f"✅ Klaar in {round(time.time() - start_time, 2)} seconden.")

if __name__ == "__main__":
    main()
