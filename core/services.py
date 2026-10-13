import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from core.exceptions import (
    IdempotencyConflictError,
    InsufficientStockError,
    InvalidTransitionError,
    NotFoundError,
    OrderLockedError,
    ValidationError,
)
from core.models import Dealer, Inventory, Order, OrderItem, Product


def round_half_up(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def validate_order_items_payload(items_data: list) -> list:
    if not isinstance(items_data, list) or len(items_data) == 0:
        raise ValidationError("At least one item is required in items list.")

    skus_seen = set()
    validated_items = []

    for item in items_data:
        if not isinstance(item, dict):
            raise ValidationError("Each item must be an object.")

        sku = item.get("sku")
        if not sku or not isinstance(sku, str):
            raise ValidationError("Item 'sku' is required and must be a string.")

        sku = sku.strip()
        if sku in skus_seen:
            raise ValidationError(f"Duplicate SKU '{sku}' found in order items.")
        skus_seen.add(sku)

        quantity = item.get("quantity")
        if quantity is None or not isinstance(quantity, int) or quantity < 1:
            raise ValidationError(f"Quantity for SKU '{sku}' must be an integer >= 1.")

        validated_items.append({"sku": sku, "quantity": quantity})

    existing_products = {p.sku: p for p in Product.objects.filter(sku__in=skus_seen)}
    for item in validated_items:
        if item["sku"] not in existing_products:
            raise ValidationError(f"Product with SKU '{item['sku']}' does not exist.")
        item["product"] = existing_products[item["sku"]]

    return validated_items


def create_draft_order(dealer_id: int, items_data: list, idempotency_key: str = None, raw_body: bytes = None):
    if not dealer_id or not isinstance(dealer_id, int):
        raise ValidationError("dealer_id is required and must be an integer.")

    try:
        dealer = Dealer.objects.get(id=dealer_id)
    except Dealer.DoesNotExist:
        raise ValidationError(f"Dealer with id {dealer_id} does not exist.")

    # Idempotency check before payload validation if duplicate request
    body_hash = None
    if raw_body:
        try:
            parsed = json.loads(raw_body)
            body_hash = hashlib.sha256(json.dumps(parsed, sort_keys=True).encode()).hexdigest()
        except Exception:
            body_hash = hashlib.sha256(raw_body).hexdigest()

    if idempotency_key:
        existing_order = Order.objects.filter(idempotency_key=idempotency_key).first()
        if existing_order:
            if existing_order.idempotency_body_hash == body_hash:
                return existing_order, False
            raise IdempotencyConflictError("Idempotency-Key reused with different request payload.")

    validated_items = validate_order_items_payload(items_data)

    with transaction.atomic():
        order_number = Order.generate_order_number()
        order = Order.objects.create(
            order_number=order_number,
            dealer=dealer,
            status=Order.STATUS_DRAFT,
            idempotency_key=idempotency_key,
            idempotency_body_hash=body_hash,
        )

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")

        for item in validated_items:
            product = item["product"]
            qty = item["quantity"]
            unit_price = product.price
            line_subtotal = round_half_up(unit_price * qty)
            line_tax = round_half_up(line_subtotal * Decimal("0.18"))
            line_total = line_subtotal + line_tax

            OrderItem.objects.create(
                order=order,
                product=product,
                name=product.name,
                quantity=qty,
                unit_price=unit_price,
                line_subtotal=line_subtotal,
                line_tax=line_tax,
                line_total=line_total,
            )

            subtotal += line_subtotal
            tax_total += line_tax

        order.subtotal = subtotal
        order.tax_total = tax_total
        order.grand_total = subtotal + tax_total
        order.save(update_fields=["subtotal", "tax_total", "grand_total"])

        return order, True


def update_draft_order_items(order_number: str, items_data: list) -> Order:
    try:
        order = Order.objects.get(order_number=order_number)
    except Order.DoesNotExist:
        raise NotFoundError(f"Order '{order_number}' not found.")

    if order.status != Order.STATUS_DRAFT:
        raise OrderLockedError("Only DRAFT orders can be edited.")

    validated_items = validate_order_items_payload(items_data)

    with transaction.atomic():
        order.items.all().delete()

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")

        for item in validated_items:
            product = item["product"]
            qty = item["quantity"]
            unit_price = product.price
            line_subtotal = round_half_up(unit_price * qty)
            line_tax = round_half_up(line_subtotal * Decimal("0.18"))
            line_total = line_subtotal + line_tax

            OrderItem.objects.create(
                order=order,
                product=product,
                name=product.name,
                quantity=qty,
                unit_price=unit_price,
                line_subtotal=line_subtotal,
                line_tax=line_tax,
                line_total=line_total,
            )

            subtotal += line_subtotal
            tax_total += line_tax

        order.subtotal = subtotal
        order.tax_total = tax_total
        order.grand_total = subtotal + tax_total
        order.save(update_fields=["subtotal", "tax_total", "grand_total", "updated_at"])

        return order


def confirm_order(order_number: str) -> Order:
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(order_number=order_number)
        except Order.DoesNotExist:
            raise NotFoundError(f"Order '{order_number}' not found.")

        if order.status != Order.STATUS_DRAFT:
            raise InvalidTransitionError(f"Cannot confirm order in status '{order.status}'.")

        order_items = list(order.items.select_related("product").all())
        sku_list = [it.product_id for it in order_items]

        # Lock inventories for consistency
        inventories = {
            inv.product_id: inv
            for inv in Inventory.objects.select_for_update().filter(product_id__in=sku_list)
        }

        short_lines = []
        messages = []

        for it in order_items:
            inv = inventories.get(it.product_id)
            avail = inv.quantity if inv else 0
            if it.quantity > avail:
                short_lines.append(
                    {"sku": it.product_id, "requested": it.quantity, "available": avail}
                )
                messages.append(
                    f"Insufficient stock for {it.name}. Available: {avail}, Requested: {it.quantity}"
                )

        if short_lines:
            raise InsufficientStockError(
                message=" ".join(messages),
                details=short_lines,
            )

        # Deduct stock and lock prices
        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")

        for it in order_items:
            inv = inventories[it.product_id]
            inv.quantity -= it.quantity
            inv.reason = f"Deducted for order {order.order_number}"
            inv.save(update_fields=["quantity", "reason", "updated_at"])

            # Lock unit price to current product price
            it.unit_price = it.product.price
            it.line_subtotal = round_half_up(it.unit_price * it.quantity)
            it.line_tax = round_half_up(it.line_subtotal * Decimal("0.18"))
            it.line_total = it.line_subtotal + it.line_tax
            it.save(update_fields=["unit_price", "line_subtotal", "line_tax", "line_total"])

            subtotal += it.line_subtotal
            tax_total += it.line_tax

        order.subtotal = subtotal
        order.tax_total = tax_total
        order.grand_total = subtotal + tax_total
        order.status = Order.STATUS_CONFIRMED
        order.save(update_fields=["status", "subtotal", "tax_total", "grand_total", "updated_at"])

        return order


def dispatch_order(order_number: str) -> Order:
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(order_number=order_number)
        except Order.DoesNotExist:
            raise NotFoundError(f"Order '{order_number}' not found.")

        if order.status != Order.STATUS_CONFIRMED:
            raise InvalidTransitionError(f"Cannot dispatch order in status '{order.status}'.")

        order.status = Order.STATUS_DISPATCHED
        order.save(update_fields=["status", "updated_at"])
        return order


def deliver_order(order_number: str) -> Order:
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(order_number=order_number)
        except Order.DoesNotExist:
            raise NotFoundError(f"Order '{order_number}' not found.")

        if order.status != Order.STATUS_DISPATCHED:
            raise InvalidTransitionError(f"Cannot deliver order in status '{order.status}'.")

        order.status = Order.STATUS_DELIVERED
        order.save(update_fields=["status", "updated_at"])
        return order


def cancel_order(order_number: str) -> Order:
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(order_number=order_number)
        except Order.DoesNotExist:
            raise NotFoundError(f"Order '{order_number}' not found.")

        if order.status == Order.STATUS_DRAFT:
            order.status = Order.STATUS_CANCELLED
            order.save(update_fields=["status", "updated_at"])
            return order

        elif order.status == Order.STATUS_CONFIRMED:
            # Restore stock
            order_items = list(order.items.all())
            sku_list = [it.product_id for it in order_items]
            inventories = {
                inv.product_id: inv
                for inv in Inventory.objects.select_for_update().filter(product_id__in=sku_list)
            }

            for it in order_items:
                inv = inventories.get(it.product_id)
                if inv:
                    inv.quantity += it.quantity
                    inv.reason = f"Restored from cancelled order {order.order_number}"
                    inv.save(update_fields=["quantity", "reason", "updated_at"])

            order.status = Order.STATUS_CANCELLED
            order.save(update_fields=["status", "updated_at"])
            return order

        else:
            raise InvalidTransitionError(f"Cannot cancel order in status '{order.status}'.")


def refresh_draft_order_pricing(order: Order) -> Order:
    if order.status != Order.STATUS_DRAFT:
        return order

    items = list(order.items.select_related("product").all())
    changed = False
    subtotal = Decimal("0.00")
    tax_total = Decimal("0.00")

    for it in items:
        if it.unit_price != it.product.price:
            it.unit_price = it.product.price
            it.line_subtotal = round_half_up(it.unit_price * it.quantity)
            it.line_tax = round_half_up(it.line_subtotal * Decimal("0.18"))
            it.line_total = it.line_subtotal + it.line_tax
            it.save(update_fields=["unit_price", "line_subtotal", "line_tax", "line_total"])
            changed = True
        subtotal += it.line_subtotal
        tax_total += it.line_tax

    if changed:
        order.subtotal = subtotal
        order.tax_total = tax_total
        order.grand_total = subtotal + tax_total
        order.save(update_fields=["subtotal", "tax_total", "grand_total"])

    return order
