import zoneinfo
from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone


class Product(models.Model):
    sku = models.CharField(max_length=50, primary_key=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, db_index=True)
    brand = models.CharField(max_length=100, db_index=True)
    vehicle_fitment = models.CharField(max_length=255, db_index=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"
        ordering = ["sku"]

    def __str__(self):
        return f"{self.sku} - {self.name}"

    @property
    def stock(self) -> int:
        if hasattr(self, "inventory"):
            return self.inventory.quantity
        return 0


class Inventory(models.Model):
    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        related_name="inventory",
        primary_key=True,
        to_field="sku",
        db_column="sku",
    )
    quantity = models.IntegerField(default=0)
    reason = models.CharField(max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory"
        constraints = [
            models.CheckConstraint(
                check=models.Q(quantity__gte=0),
                name="inventory_quantity_non_negative",
            )
        ]

    def __str__(self):
        return f"{self.product_id}: {self.quantity}"


class Dealer(models.Model):
    dealer_code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=100, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.CharField(max_length=255, blank=True, default="")
    gstin = models.CharField(max_length=50, blank=True, default="")
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dealers"
        ordering = ["id"]

    def __str__(self):
        return f"{self.dealer_code} - {self.name}"


class Order(models.Model):
    STATUS_DRAFT = "DRAFT"
    STATUS_CONFIRMED = "CONFIRMED"
    STATUS_DISPATCHED = "DISPATCHED"
    STATUS_DELIVERED = "DELIVERED"
    STATUS_CANCELLED = "CANCELLED"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "DRAFT"),
        (STATUS_CONFIRMED, "CONFIRMED"),
        (STATUS_DISPATCHED, "DISPATCHED"),
        (STATUS_DELIVERED, "DELIVERED"),
        (STATUS_CANCELLED, "CANCELLED"),
    ]

    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    dealer = models.ForeignKey(Dealer, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    idempotency_key = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    idempotency_body_hash = models.CharField(max_length=64, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orders"
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.order_number} ({self.status})"

    @classmethod
    def generate_order_number(cls) -> str:
        kolkata = zoneinfo.ZoneInfo("Asia/Kolkata")
        today_str = timezone.now().astimezone(kolkata).strftime("%Y%m%d")
        with transaction.atomic():
            seq, _ = DailyOrderSequence.objects.select_for_update().get_or_create(
                date_str=today_str,
                defaults={"last_sequence": 0},
            )
            seq.last_sequence += 1
            seq.save(update_fields=["last_sequence"])
            return f"ORD-{today_str}-{seq.last_sequence:04d}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items", db_column="sku")
    name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    line_tax = models.DecimalField(max_digits=14, decimal_places=2)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        db_table = "order_items"
        constraints = [
            models.UniqueConstraint(fields=["order", "product"], name="unique_order_product"),
            models.CheckConstraint(check=models.Q(quantity__gte=1), name="order_item_quantity_gte_1"),
        ]

    def __str__(self):
        return f"{self.order.order_number}: {self.product_id} x {self.quantity}"


class DailyOrderSequence(models.Model):
    date_str = models.CharField(max_length=8, primary_key=True)
    last_sequence = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "daily_order_sequences"


class AssistantSessionMessage(models.Model):
    session_id = models.CharField(max_length=255, db_index=True)
    role = models.CharField(max_length=50)
    content = models.TextField()
    tool_calls = models.JSONField(default=list, blank=True)
    actions = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_session_messages"
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.session_id} - {self.role}: {self.content[:30]}"
