from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import (
    DuplicateError,
    NotFoundError,
    ValidationError,
)
from core.models import Dealer, Inventory, Order, Product
from core.pagination import StandardPagination
from core.serializers import (
    DealerSerializer,
    OrderSerializer,
    ProductSerializer,
    validate_price_value,
)
from core.services import (
    cancel_order,
    confirm_order,
    create_draft_order,
    deliver_order,
    dispatch_order,
    refresh_draft_order_pricing,
    update_draft_order_items,
)
from core.assistant_service import chat_with_assistant
from core.forecast_service import get_reorder_suggestions, get_sku_forecast
from core.supplier_service import sync_supplier_catalog


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


class ProductListCreateView(APIView):
    pagination_class = StandardPagination

    def get(self, request):
        qs = Product.objects.select_related("inventory").all()

        search = request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(sku__icontains=search)
                | Q(name__icontains=search)
                | Q(brand__icontains=search)
            )

        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)

        vehicle = request.query_params.get("vehicle")
        if vehicle:
            qs = qs.filter(vehicle_fitment__icontains=vehicle)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = ProductSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        data = request.data
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object.")

        sku = data.get("sku")
        name = data.get("name")
        category = data.get("category")
        brand = data.get("brand")
        vehicle_fitment = data.get("vehicle_fitment")
        price_val = data.get("price")
        description = data.get("description", "")

        for field_name, val in [
            ("sku", sku),
            ("name", name),
            ("category", category),
            ("brand", brand),
            ("vehicle_fitment", vehicle_fitment),
        ]:
            if not val or not isinstance(val, str) or not val.strip():
                raise ValidationError(f"Field '{field_name}' is required.")

        sku = sku.strip()
        if Product.objects.filter(sku=sku).exists():
            raise DuplicateError(f"Product with SKU '{sku}' already exists.")

        if price_val is None:
            raise ValidationError("Field 'price' is required.")
        price = validate_price_value(price_val)

        with transaction.atomic():
            product = Product.objects.create(
                sku=sku,
                name=name.strip(),
                category=category.strip(),
                brand=brand.strip(),
                vehicle_fitment=vehicle_fitment.strip(),
                price=price,
                description=str(description).strip(),
            )
            Inventory.objects.create(
                product=product,
                quantity=0,
                reason="product creation",
            )

        serializer = ProductSerializer(product)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProductDetailView(APIView):
    def get(self, request, sku):
        try:
            product = Product.objects.select_related("inventory").get(sku=sku)
        except Product.DoesNotExist:
            raise NotFoundError(f"Product with SKU '{sku}' not found.")
        serializer = ProductSerializer(product)
        return Response(serializer.data)

    def patch(self, request, sku):
        try:
            product = Product.objects.select_related("inventory").get(sku=sku)
        except Product.DoesNotExist:
            raise NotFoundError(f"Product with SKU '{sku}' not found.")

        data = request.data
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object.")

        update_fields = []
        if "name" in data:
            product.name = str(data["name"]).strip()
            update_fields.append("name")
        if "category" in data:
            product.category = str(data["category"]).strip()
            update_fields.append("category")
        if "brand" in data:
            product.brand = str(data["brand"]).strip()
            update_fields.append("brand")
        if "vehicle_fitment" in data:
            product.vehicle_fitment = str(data["vehicle_fitment"]).strip()
            update_fields.append("vehicle_fitment")
        if "description" in data:
            product.description = str(data["description"]).strip()
            update_fields.append("description")
        if "price" in data:
            product.price = validate_price_value(data["price"])
            update_fields.append("price")

        if update_fields:
            update_fields.append("updated_at")
            product.save(update_fields=update_fields)

        serializer = ProductSerializer(product)
        return Response(serializer.data)


class InventoryView(APIView):
    def put(self, request, sku):
        try:
            product = Product.objects.get(sku=sku)
        except Product.DoesNotExist:
            raise NotFoundError(f"Product with SKU '{sku}' not found.")

        data = request.data
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object.")

        quantity = data.get("quantity")
        if quantity is None or not isinstance(quantity, int) or quantity < 0:
            raise ValidationError("Field 'quantity' must be an integer >= 0.")

        reason = str(data.get("reason", "")).strip()

        inventory, _ = Inventory.objects.update_or_create(
            product=product,
            defaults={"quantity": quantity, "reason": reason},
        )

        return Response({"sku": product.sku, "quantity": inventory.quantity})


class DealerListCreateView(APIView):
    pagination_class = StandardPagination

    def get(self, request):
        qs = Dealer.objects.all()
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = DealerSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        data = request.data
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object.")

        dealer_code = data.get("dealer_code")
        name = data.get("name")
        if not dealer_code or not isinstance(dealer_code, str) or not dealer_code.strip():
            raise ValidationError("Field 'dealer_code' is required.")
        if not name or not isinstance(name, str) or not name.strip():
            raise ValidationError("Field 'name' is required.")

        dealer_code = dealer_code.strip()
        if Dealer.objects.filter(dealer_code=dealer_code).exists():
            raise DuplicateError(f"Dealer with code '{dealer_code}' already exists.")

        credit_limit = Decimal("0.00")
        if "credit_limit" in data:
            try:
                credit_limit = Decimal(str(data["credit_limit"]))
            except Exception:
                raise ValidationError("Invalid credit_limit value.")

        dealer = Dealer.objects.create(
            dealer_code=dealer_code,
            name=name.strip(),
            city=str(data.get("city", "")).strip(),
            phone=str(data.get("phone", "")).strip(),
            email=str(data.get("email", "")).strip(),
            gstin=str(data.get("gstin", "")).strip(),
            credit_limit=credit_limit,
        )

        serializer = DealerSerializer(dealer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DealerDetailView(APIView):
    def get(self, request, dealer_id):
        try:
            dealer = Dealer.objects.get(id=dealer_id)
        except Dealer.DoesNotExist:
            raise NotFoundError(f"Dealer with id {dealer_id} not found.")
        serializer = DealerSerializer(dealer)
        return Response(serializer.data)


class OrderListCreateView(APIView):
    pagination_class = StandardPagination

    def get(self, request):
        qs = Order.objects.select_related("dealer").prefetch_related("items").all()

        dealer_id = request.query_params.get("dealer_id")
        if dealer_id:
            try:
                qs = qs.filter(dealer_id=int(dealer_id))
            except ValueError:
                raise ValidationError("Query param 'dealer_id' must be an integer.")

        order_status = request.query_params.get("status")
        if order_status:
            qs = qs.filter(status=order_status)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = OrderSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        data = request.data
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object.")

        dealer_id = data.get("dealer_id")
        items = data.get("items")
        idempotency_key = request.headers.get("Idempotency-Key")

        order, is_new = create_draft_order(
            dealer_id=dealer_id,
            items_data=items,
            idempotency_key=idempotency_key,
            raw_body=request.body,
        )

        serializer = OrderSerializer(order)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if is_new else status.HTTP_200_OK,
        )


class OrderDetailView(APIView):
    def get(self, request, order_number):
        try:
            order = (
                Order.objects.select_related("dealer")
                .prefetch_related("items")
                .get(order_number=order_number)
            )
        except Order.DoesNotExist:
            raise NotFoundError(f"Order '{order_number}' not found.")
        order = refresh_draft_order_pricing(order)
        serializer = OrderSerializer(order)
        return Response(serializer.data)

    def put(self, request, order_number):
        data = request.data
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object.")

        items = data.get("items")
        order = update_draft_order_items(order_number, items)
        serializer = OrderSerializer(order)
        return Response(serializer.data)


class OrderConfirmView(APIView):
    def post(self, request, order_number):
        order = confirm_order(order_number)
        serializer = OrderSerializer(order)
        return Response(serializer.data)


class OrderDispatchView(APIView):
    def post(self, request, order_number):
        order = dispatch_order(order_number)
        serializer = OrderSerializer(order)
        return Response(serializer.data)


class OrderDeliverView(APIView):
    def post(self, request, order_number):
        order = deliver_order(order_number)
        serializer = OrderSerializer(order)
        return Response(serializer.data)


class OrderCancelView(APIView):
    def post(self, request, order_number):
        order = cancel_order(order_number)
        serializer = OrderSerializer(order)
        return Response(serializer.data)


class SupplierSyncView(APIView):
    def post(self, request):
        result = sync_supplier_catalog()
        return Response(result, status=status.HTTP_200_OK)


class AssistantChatView(APIView):
    def post(self, request):
        data = request.data
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object.")

        session_id = data.get("session_id")
        dealer_id = data.get("dealer_id")
        message = data.get("message")

        result = chat_with_assistant(session_id, dealer_id, message)
        return Response(result, status=status.HTTP_200_OK)


class ForecastDetailView(APIView):
    def get(self, request, sku):
        result = get_sku_forecast(sku)
        return Response(result, status=status.HTTP_200_OK)


class ReorderSuggestionsView(APIView):
    def get(self, request):
        results = get_reorder_suggestions()
        return Response({"results": results}, status=status.HTTP_200_OK)
