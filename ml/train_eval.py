import csv
import math
from collections import defaultdict
from datetime import datetime, timedelta

def load_data():
    with open('data/lead_times.csv', encoding='utf-8') as f:
        lead_times = {r['sku']: int(r['lead_time_weeks']) for r in csv.DictReader(f)}

    sales = defaultdict(list)
    with open('data/sales_history.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            sales[r['sku']].append({
                'week_start': r['week_start'],
                'units_sold': float(r['units_sold']),
                'promo_flag': int(r['promo_flag']),
            })

    for sku in sales:
        sales[sku].sort(key=lambda x: x['week_start'])

    with open('data/promo_calendar.csv', encoding='utf-8') as f:
        future_promos = defaultdict(dict)
        for r in csv.DictReader(f):
            future_promos[r['sku']][r['week_start']] = int(r['promo_flag'])

    with open('data/festival_calendar.csv', encoding='utf-8') as f:
        festivals = {r['festival']: r['date'] for r in csv.DictReader(f)}

    return lead_times, sales, future_promos, festivals

def get_diwali_offset_weeks(week_str):
    # Week starts on Monday
    w_dt = datetime.strptime(week_str, "%Y-%m-%d")
    year = w_dt.year
    diwali_dates = {
        2024: datetime(2024, 11, 1),
        2025: datetime(2025, 10, 21),
        2026: datetime(2026, 11, 8),
    }
    diwali = diwali_dates.get(year, datetime(year, 11, 1))
    diff_days = (w_dt - diwali).days
    return int(round(diff_days / 7.0))

def estimate_promo_lift(history):
    # Estimate multiplicative lift of promo
    non_promo = [x['units_sold'] for x in history if x['promo_flag'] == 0]
    promo = [x['units_sold'] for x in history if x['promo_flag'] == 1]
    base_mean = sum(non_promo) / len(non_promo) if non_promo else 1.0
    if not promo or base_mean <= 0.1:
        return 1.3  # general default
    promo_mean = sum(promo) / len(promo)
    lift = promo_mean / base_mean
    return max(1.05, min(lift, 2.5))  # clip between 1.05 and 2.5

def fit_predict_sku(sku, history, target_weeks, target_promos):
    if not history:
        return {w: 0.0 for w in target_weeks}

    # If very short history (e.g. 6 weeks), use recent non-promo or weighted mean
    n = len(history)
    promo_lift = estimate_promo_lift(history)

    # Base demand estimation (de-promoted history)
    depromoted = []
    for x in history:
        val = x['units_sold']
        if x['promo_flag'] == 1:
            val = val / promo_lift
        depromoted.append(val)

    # Trend / Level using Exponential Smoothing or Weighted Recent Average
    if n <= 8:
        # short launch: average of available weeks
        base_level = sum(depromoted) / len(depromoted)
        trend = 0.0
    else:
        # Weighted average of last 8 weeks (more weight on recent)
        recent = depromoted[-8:]
        weights = [1.0 + 0.15 * i for i in range(len(recent))]
        base_level = sum(r * w for r, w in zip(recent, weights)) / sum(weights)
        
        # Simple dampened trend from last 8 weeks
        half = len(recent) // 2
        first_half = sum(recent[:half]) / half
        second_half = sum(recent[half:]) / (len(recent) - half)
        trend = (second_half - first_half) / half
        trend = max(-0.15 * base_level, min(0.15 * base_level, trend * 0.5))  # dampened

    # Diwali festive lift factor
    # Check if there is festive lift in history at corresponding offset
    festive_factors = {}
    for offset in range(-8, 2):
        matching = [
            x['units_sold'] for x in history 
            if get_diwali_offset_weeks(x['week_start']) == offset and x['promo_flag'] == 0
        ]
        if matching and base_level > 0.5:
            avg_festive = sum(matching) / len(matching)
            ratio = avg_festive / base_level
            if 0.8 < ratio < 2.5:
                festive_factors[offset] = ratio

    preds = {}
    for step, w in enumerate(target_weeks, start=1):
        # Step trend
        level_step = max(0.0, base_level + trend * step)
        
        # Festive adjustment if available
        offset = get_diwali_offset_weeks(w)
        festive_mult = festive_factors.get(offset, 1.0)
        # blend festive mult slightly
        festive_mult = 0.7 * festive_mult + 0.3 * 1.0
        
        step_pred = level_step * festive_mult

        # Apply promo lift if scheduled
        is_promo = target_promos.get(w, 0)
        if is_promo:
            step_pred *= promo_lift

        preds[w] = max(0.0, round(step_pred, 1))

    return preds

def run():
    lead_times, sales, future_promos, festivals = load_data()
    val_weeks = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21']

    train_sales = {}
    actuals = {}
    val_promos = defaultdict(dict)
    for sku in lead_times:
        train_sales[sku] = [x for x in sales[sku] if x['week_start'] < val_weeks[0]]
        actuals[sku] = {x['week_start']: x['units_sold'] for x in sales[sku] if x['week_start'] in val_weeks}
        for x in sales[sku]:
            if x['week_start'] in val_weeks:
                val_promos[sku][x['week_start']] = x['promo_flag']

    # Model predictions
    model_preds = {}
    for sku in lead_times:
        model_preds[sku] = fit_predict_sku(sku, train_sales[sku], val_weeks, val_promos[sku])

    # Compute metrics
    total_abs_err = 0.0
    total_actual = 0.0
    n = 0
    for sku in lead_times:
        for w in val_weeks:
            act = actuals[sku].get(w, 0.0)
            pred = model_preds[sku].get(w, 0.0)
            total_abs_err += abs(act - pred)
            total_actual += act
            n += 1

    mae = total_abs_err / n
    wape = total_abs_err / total_actual * 100
    print(f"Engineered Model: MAE = {mae:.2f}, WAPE = {wape:.2f}%")

if __name__ == '__main__':
    run()
