import csv
from collections import defaultdict

def main():
    with open('data/lead_times.csv', encoding='utf-8') as f:
        lead_skus = [r['sku'] for r in csv.DictReader(f)]

    print(f"Total lead_skus: {len(lead_skus)}")

    sales = defaultdict(list)
    with open('data/sales_history.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            sales[r['sku']].append((r['week_start'], int(r['units_sold']), int(r['promo_flag'])))

    for sku in lead_skus[:5]:
        history = sales[sku]
        print(f"SKU: {sku}, history len: {len(history)}, first: {history[0]}, last: {history[-1]}")

    all_weeks = sorted({w for rows in sales.values() for w, _, _ in rows})
    print(f"Historical week range: {all_weeks[0]} to {all_weeks[-1]}, total weeks: {len(all_weeks)}")

    with open('data/promo_calendar.csv', encoding='utf-8') as f:
        promo_rows = list(csv.DictReader(f))
    print(f"Promo calendar rows: {len(promo_rows)}, weeks: {sorted({r['week_start'] for r in promo_rows})}")

if __name__ == '__main__':
    main()
