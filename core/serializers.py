from decimal import Decimal
from rest_framework import serializers
from core.models import Dealer, Order, OrderItem, Product


def validate_price_value(value) -> Decimal:
    try:
        dec = Decimal(str(value))
    except Exception:
        raise serializers.ValidationError("Price must be a valid number.")

    if dec <= Decimal("0"):
        raise serializers.ValidationError("Price must be greater than 0.")

    if dec.as_tuple().exponent < -2:
        raise serializers.ValidationError("Price must have at most 2 decimal places.")

    return dec


class ProductSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()
    stock = serializers.IntegerField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "sku",
            "name",
            "category",
            "brand",
            "vehicle_fitment",
            "price",
            "stock",
            "description",
        ]

    def get_price(self, obj) -> str:
        return f"{obj.price:.2f}"

    def validate_price(self, value):
        return validate_price_value(value)


class ProductCreateSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        model = Product
        fields = [
            "sku",
            "name",
            "category",
            "brand",
            "vehicle_fitment",
            "price",
            "description",
        ]

    def validate_price(self, value):
        return validate_price_value(value)


class DealerSerializer(serializers.ModelSerializer):
    credit_limit = serializers.SerializerMethodField()

    class Meta:
        model = Dealer
        fields = [
            "id",
            "dealer_code",
            "name",
            "city",
            "phone",
            "email",
            "gstin",
            "credit_limit",
        ]

    def get_credit_limit(self, obj) -> str:
        return f"{obj.credit_limit:.2f}"


class OrderItemSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(source="product_id")
    unit_price = serializers.SerializerMethodField()
    line_subtotal = serializers.SerializerMethodField()
    line_tax = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "sku",
            "name",
            "quantity",
            "unit_price",
            "line_subtotal",
            "line_tax",
            "line_total",
        ]

    def get_unit_price(self, obj) -> str:
        return f"{obj.unit_price:.2f}"

    def get_line_subtotal(self, obj) -> str:
        return f"{obj.line_subtotal:.2f}"

    def get_line_tax(self, obj) -> str:
        return f"{obj.line_tax:.2f}"

    def get_line_total(self, obj) -> str:
        return f"{obj.line_total:.2f}"


class OrderSerializer(serializers.ModelSerializer):
    dealer_id = serializers.IntegerField(source="dealer.id")
    items = OrderItemSerializer(many=True, read_only=True)
    subtotal = serializers.SerializerMethodField()
    tax_total = serializers.SerializerMethodField()
    grand_total = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "order_number",
            "dealer_id",
            "status",
            "items",
            "subtotal",
            "tax_total",
            "grand_total",
            "created_at",
            "updated_at",
        ]

    def get_subtotal(self, obj) -> str:
        return f"{obj.subtotal:.2f}"

    def get_tax_total(self, obj) -> str:
        return f"{obj.tax_total:.2f}"

    def get_grand_total(self, obj) -> str:
        return f"{obj.grand_total:.2f}"
