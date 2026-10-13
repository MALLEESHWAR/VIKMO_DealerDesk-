import csv
import math
import statistics
from pathlib import Path
from django.conf import settings
from core.exceptions import NotFoundError
from core.models import Inventory


def load_forecast_csv():
    forecast_path = Path(settings.BASE_DIR) / "ml" / "forecast.csv"
    if not forecast_path.exists():
        raise NotFoundError("Forecast file ml/forecast.csv not found.")

    sku_forecasts = {}
    with open(forecast_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = row["sku"].strip()
            week = row["week_start"].strip()
            units = float(row["forecast_units"].strip())
            if sku not in sku_forecasts:
                sku_forecasts[sku] = []
            sku_forecasts[sku].append({"week_start": week, "forecast_units": units})

    return sku_forecasts


def get_sku_forecast(sku: str) -> dict:
    sku_forecasts = load_forecast_csv()
    if sku not in sku_forecasts:
        raise NotFoundError(f"Forecast for SKU '{sku}' not found.")

    return {
        "sku": sku,
        "forecast": sku_forecasts[sku],
    }


def get_reorder_suggestions() -> list:
    data_dir = Path(settings.DATA_DIR)
    lead_times_path = data_dir / "lead_times.csv"
    sales_history_path = data_dir / "sales_history.csv"

    if not lead_times_path.exists():
        raise NotFoundError("lead_times.csv not found.")
    if not sales_history_path.exists():
        raise NotFoundError("sales_history.csv not found.")

    # 1. Lead times
    lead_times = {}
    with open(lead_times_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lead_times[row["sku"].strip()] = int(row["lead_time_weeks"].strip())

    # 2. Forecasts
    sku_forecasts = load_forecast_csv()

    # 3. Sales history for standard deviation (most recent 12 weeks per SKU)
    sku_sales_history = {}
    with open(sales_history_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = row["sku"].strip()
            if sku in lead_times:
                if sku not in sku_sales_history:
                    sku_sales_history[sku] = []
                sku_sales_history[sku].append({
                    "week_start": row["week_start"].strip(),
                    "units_sold": float(row["units_sold"].strip()),
                })

    # Sort sales history chronologically
    for sku in sku_sales_history:
        sku_sales_history[sku].sort(key=lambda x: x["week_start"])

    # 4. Live stock from Inventory
    live_stocks = {
        inv.product_id: inv.quantity
        for inv in Inventory.objects.filter(product_id__in=lead_times.keys())
    }

    results = []
    # Preserve ordering of lead_times.csv
    for sku, lead_time_weeks in lead_times.items():
        current_stock = live_stocks.get(sku, 0)
        
        # Forecast for first L weeks
        forecast_list = sku_forecasts.get(sku, [])
        l_weeks_forecast = forecast_list[:lead_time_weeks]
        lead_time_demand = round(sum(item["forecast_units"] for item in l_weeks_forecast), 1)

        # Sigma over most recent 12 weeks of sales history
        hist = sku_sales_history.get(sku, [])
        recent_12 = hist[-12:] if len(hist) >= 12 else hist
        units_list = [x["units_sold"] for x in recent_12]

        if len(units_list) >= 2:
            sigma = statistics.stdev(units_list)
        else:
            sigma = 0.0

        safety_stock = math.ceil(1.65 * sigma * math.sqrt(lead_time_weeks))
        reorder_point = round(lead_time_demand + safety_stock, 1)
        reorder_qty = max(0, math.ceil(reorder_point - current_stock))

        results.append({
            "sku": sku,
            "current_stock": current_stock,
            "lead_time_weeks": lead_time_weeks,
            "lead_time_demand": lead_time_demand,
            "safety_stock": safety_stock,
            "reorder_point": reorder_point,
            "reorder_qty": reorder_qty,
        })

    return results
