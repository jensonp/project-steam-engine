import csv
import sys

games_csv = "/Users/jensonphan/cs125/backend/data/raw/games.csv"

with open(games_csv, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    print('app_id,name,price,positive,negative')
    count = 0
    for row in reader:
        if count >= 10000:
            break
        try:
            app_id = row.get('AppID', '').strip()
            name = row.get('Name', '').replace('"', '').replace(',', ' ')[:200]
            price_str = row.get('Price', '0').strip()
            price = float(price_str) if price_str.replace('.','').isdigit() else 0
            positive = int(row.get('Positive', 0) or 0)
            negative = int(row.get('Negative', 0) or 0)
            if app_id:
                print(f'{app_id},"{name}",{price},{positive},{negative}')
                count += 1
        except Exception as e:
            continue
