import math
import time
from decimal import Decimal
import requests
from django.conf import settings
from django.db import transaction
from core.exceptions import ContractError
from core.models import Inventory, Product


class SupplierUnavailableError(ContractError):
    def __init__(self, message: str = "Supplier unavailable", details: list = None):
        super().__init__("SUPPLIER_UNAVAILABLE", message, status_code=502, details=details)


def validate_supplier_item(item: dict) -> tuple[bool, str, Decimal]:
    if not isinstance(item, dict):
        return False, "item is not a dictionary", Decimal("0")

    sku = item.get("sku")
    if not sku or not isinstance(sku, str) or not sku.strip():
        return False, "missing or empty sku", Decimal("0")

    price_val = item.get("price")
    if price_val is None:
        return False, "missing price", Decimal("0")

    try:
        dec = Decimal(str(price_val).strip())
    except Exception:
        return False, "invalid price format", Decimal("0")

    if dec <= Decimal("0"):
        return False, "price must be positive", Decimal("0")

    if dec.as_tuple().exponent < -2:
        return False, "price cannot have more than 2 decimal places", Decimal("0")

    return True, "", dec


def fetch_supplier_feed() -> tuple[list, int, int]:
    base_url = getattr(settings, "SUPPLIER_API_URL", "http://127.0.0.1:8099").rstrip("/")
    api_key = getattr(settings, "SUPPLIER_API_KEY", "")
    endpoint = f"{base_url}/v1/products"

    cursor = None
    all_raw_items = []
    pages_fetched = 0
    requests_made = 0
    session = requests.Session()

    while True:
        params = {"limit": 20}
        if cursor:
            params["cursor"] = cursor

        headers = {}
        if api_key:
            headers["X-Api-Key"] = api_key

        success = False
        page_items = []
        next_cursor = None

        for attempt in range(1, 6):
            requests_made += 1
            try:
                resp = session.get(endpoint, params=params, headers=headers, timeout=20)
            except requests.RequestException:
                if attempt == 5:
                    raise SupplierUnavailableError(f"Connection failed after 5 attempts for cursor '{cursor}'")
                time.sleep(0.3 * attempt)
                continue

            if resp.status_code == 200:
                try:
                    data = resp.json()
                    page_items = data.get("items", [])
                    next_cursor = data.get("next_cursor")
                    success = True
                    pages_fetched += 1
                    break
                except Exception:
                    if attempt == 5:
                        raise SupplierUnavailableError("Invalid JSON received from supplier.")
                    time.sleep(0.3 * attempt)
                    continue

            elif resp.status_code == 429:
                if attempt == 5:
                    raise SupplierUnavailableError("Rate limit exceeded 5 retry attempts.")
                retry_after = resp.headers.get("Retry-After")
                try:
                    wait_secs = max(1.0, float(retry_after))
                except Exception:
                    wait_secs = 1.0
                time.sleep(wait_secs)
                continue

            elif resp.status_code in (500, 502, 503, 504):
                if attempt == 5:
                    raise SupplierUnavailableError(f"Supplier returned HTTP {resp.status_code} after 5 attempts.")
                time.sleep(0.3 * attempt)
                continue

            elif resp.status_code == 401:
                raise SupplierUnavailableError("Supplier API key was rejected (HTTP 401).")

            else:
                raise SupplierUnavailableError(f"Supplier returned unexpected HTTP status {resp.status_code}.")

        if not success:
            raise SupplierUnavailableError(f"Failed to fetch page after 5 attempts for cursor '{cursor}'.")

        all_raw_items.extend(page_items)
        if not next_cursor:
            break
        cursor = next_cursor

    return all_raw_items, pages_fetched, requests_made


def sync_supplier_catalog() -> dict:
    raw_items, pages_fetched, requests_made = fetch_supplier_feed()

    rejected = []
    valid_items_by_sku = {}

    for item in raw_items:
        is_valid, reason, validated_price = validate_supplier_item(item)
        if not is_valid:
            rejected.append({
                "supplier_sku": str(item.get("supplier_sku", "")),
                "reason": reason,
            })
            continue

        sku = item["sku"].strip()
        updated_at_str = item.get("updated_at", "")

        # Deduplication by latest updated_at
        if sku in valid_items_by_sku:
            prev_updated_at = valid_items_by_sku[sku].get("updated_at", "")
            if updated_at_str > prev_updated_at:
                item_copy = dict(item)
                item_copy["_validated_price"] = validated_price
                valid_items_by_sku[sku] = item_copy
        else:
            item_copy = dict(item)
            item_copy["_validated_price"] = validated_price
            valid_items_by_sku[sku] = item_copy

    created = 0
    updated = 0
    unchanged = 0

    with transaction.atomic():
        existing_products = {
            p.sku: p
            for p in Product.objects.filter(sku__in=valid_items_by_sku.keys())
        }

        for sku, item in valid_items_by_sku.items():
            price = item["_validated_price"]
            name = str(item.get("name", "")).strip()
            category = str(item.get("category", "")).strip()
            brand = str(item.get("brand", "")).strip()
            vehicle_fitment = str(item.get("vehicle_fitment", "")).strip()
            description = str(item.get("description", "")).strip()

            if sku not in existing_products:
                # Create product with stock 0
                prod = Product.objects.create(
                    sku=sku,
                    name=name,
                    category=category,
                    brand=brand,
                    vehicle_fitment=vehicle_fitment,
                    price=price,
                    description=description,
                )
                Inventory.objects.create(
                    product=prod,
                    quantity=0,
                    reason="supplier sync initial",
                )
                created += 1
            else:
                prod = existing_products[sku]
                differs = (
                    prod.name != name
                    or prod.category != category
                    or prod.brand != brand
                    or prod.vehicle_fitment != vehicle_fitment
                    or prod.description != description
                    or prod.price != price
                )

                if differs:
                    prod.name = name
                    prod.category = category
                    prod.brand = brand
                    prod.vehicle_fitment = vehicle_fitment
                    prod.description = description
                    prod.price = price
                    prod.save(update_fields=[
                        "name", "category", "brand", "vehicle_fitment", "description", "price", "updated_at"
                    ])
                    updated += 1
                else:
                    unchanged += 1

    return {
        "created": created,
        "updated": updated,
        "unchanged": unchanged,
        "rejected": rejected,
        "pages_fetched": pages_fetched,
        "requests_made": requests_made,
    }
