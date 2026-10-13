import json
from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Dealer, Inventory, Order, OrderItem, Product


class CorePhase2Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.p1 = Product.objects.create(
            sku="TEST-001",
            name="Test Brake Pad",
            category="Brakes",
            brand="Brembo",
            vehicle_fitment="Yamaha R15 V4",
            price=Decimal("1459.50"),
            description="High quality test brake pad",
        )
        self.inv1 = Inventory.objects.create(product=self.p1, quantity=50, reason="test init")

        self.p2 = Product.objects.create(
            sku="TEST-002",
            name="Test Oil Filter",
            category="Filters",
            brand="Mahle",
            vehicle_fitment="KTM Duke 390",
            price=Decimal("250.00"),
            description="Test oil filter",
        )
        self.inv2 = Inventory.objects.create(product=self.p2, quantity=5, reason="test init")

        self.dealer = Dealer.objects.create(
            dealer_code="DLR-TEST-01",
            name="Apex Motors Test",
            city="Bengaluru",
            phone="9876543210",
            email="test@apex.in",
            gstin="29ABCDE1234F1Z5",
            credit_limit=Decimal("50000.00"),
        )

    def test_health_endpoint(self):
        res = self.client.get("/api/health/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), {"status": "ok"})

    def test_products_list_and_filters(self):
        res = self.client.get("/api/products/?page_size=10")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertIn("count", data)
        self.assertIn("results", data)
        self.assertEqual(data["count"], 2)

        p = data["results"][0]
        self.assertIn("sku", p)
        self.assertIn("name", p)
        self.assertIn("stock", p)
        self.assertIn("price", p)
        self.assertEqual(p["price"], "1459.50")
        self.assertIsInstance(p["stock"], int)

        # Filter by search
        res = self.client.get("/api/products/?search=Brembo")
        self.assertEqual(res.json()["count"], 1)

        # Filter by category
        res = self.client.get("/api/products/?category=Filters")
        self.assertEqual(res.json()["count"], 1)

        # Filter by vehicle
        res = self.client.get("/api/products/?vehicle=Yamaha")
        self.assertEqual(res.json()["count"], 1)

    def test_product_detail_and_404_error_shape(self):
        res = self.client.get("/api/products/TEST-001/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["sku"], "TEST-001")

        res_404 = self.client.get("/api/products/NONEXISTENT/")
        self.assertEqual(res_404.status_code, status.HTTP_404_NOT_FOUND)
        err = res_404.json()
        self.assertIn("error", err)
        self.assertEqual(err["error"]["code"], "NOT_FOUND")
        self.assertIsInstance(err["error"]["details"], list)

    def test_product_create_and_validation(self):
        # Create valid product
        payload = {
            "sku": "TEST-003",
            "name": "New Spark Plug",
            "category": "Electrical",
            "brand": "NGK",
            "vehicle_fitment": "Universal",
            "price": "350.00",
            "description": "Spark plug",
        }
        res = self.client.post("/api/products/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.json()["stock"], 0)

        # Duplicate SKU -> 409 DUPLICATE
        res_dup = self.client.post("/api/products/", payload, format="json")
        self.assertEqual(res_dup.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res_dup.json()["error"]["code"], "DUPLICATE")

        # Invalid price (<= 0) -> 400 VALIDATION_ERROR
        payload["sku"] = "TEST-004"
        payload["price"] = "0.00"
        res_bad = self.client.post("/api/products/", payload, format="json")
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res_bad.json()["error"]["code"], "VALIDATION_ERROR")

        # Price with > 2 decimal places -> 400
        payload["price"] = "12.345"
        res_bad2 = self.client.post("/api/products/", payload, format="json")
        self.assertEqual(res_bad2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_product_patch(self):
        res = self.client.patch("/api/products/TEST-001/", {"price": "1500.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["price"], "1500.00")

    def test_inventory_update(self):
        res = self.client.put(
            "/api/inventory/TEST-001/",
            {"quantity": 75, "reason": "restock"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), {"sku": "TEST-001", "quantity": 75})

        # Verify product detail reflects updated stock
        prod_res = self.client.get("/api/products/TEST-001/")
        self.assertEqual(prod_res.json()["stock"], 75)

        # Negative quantity -> 400
        bad_res = self.client.put(
            "/api/inventory/TEST-001/",
            {"quantity": -5},
            format="json",
        )
        self.assertEqual(bad_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(bad_res.json()["error"]["code"], "VALIDATION_ERROR")

    def test_dealers_list_create_detail(self):
        res = self.client.get("/api/dealers/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["count"], 1)

        # Create dealer
        payload = {"dealer_code": "DLR-NEW-01", "name": "New Dealer", "credit_limit": "25000.00"}
        res = self.client.post("/api/dealers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_id = res.json()["id"]

        # Duplicate dealer code -> 409 DUPLICATE
        dup = self.client.post("/api/dealers/", payload, format="json")
        self.assertEqual(dup.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(dup.json()["error"]["code"], "DUPLICATE")

        # Detail
        det = self.client.get(f"/api/dealers/{new_id}/")
        self.assertEqual(det.status_code, status.HTTP_200_OK)
        self.assertEqual(det.json()["dealer_code"], "DLR-NEW-01")

    def test_order_creation_pricing_and_gst(self):
        # 3 units of TEST-001 @ 1459.50 = 4378.50, tax = 788.13, total = 5166.63
        order_payload = {
            "dealer_id": self.dealer.id,
            "items": [{"sku": "TEST-001", "quantity": 3}],
        }
        res = self.client.post("/api/orders/", order_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data["status"], "DRAFT")
        self.assertEqual(data["subtotal"], "4378.50")
        self.assertEqual(data["tax_total"], "788.13")
        self.assertEqual(data["grand_total"], "5166.63")
        self.assertTrue(data["order_number"].startswith("ORD-"))

        item = data["items"][0]
        self.assertEqual(item["sku"], "TEST-001")
        self.assertEqual(item["unit_price"], "1459.50")
        self.assertEqual(item["line_subtotal"], "4378.50")
        self.assertEqual(item["line_tax"], "788.13")
        self.assertEqual(item["line_total"], "5166.63")

    def test_order_validation_errors(self):
        # Empty items list -> 400 VALIDATION_ERROR
        res = self.client.post(
            "/api/orders/",
            {"dealer_id": self.dealer.id, "items": []},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.json()["error"]["code"], "VALIDATION_ERROR")

        # Non-existent SKU -> 400 VALIDATION_ERROR
        res = self.client.post(
            "/api/orders/",
            {"dealer_id": self.dealer.id, "items": [{"sku": "NOPE-000", "quantity": 1}]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.json()["error"]["code"], "VALIDATION_ERROR")

        # Duplicate SKU -> 400 VALIDATION_ERROR
        res = self.client.post(
            "/api/orders/",
            {
                "dealer_id": self.dealer.id,
                "items": [
                    {"sku": "TEST-001", "quantity": 1},
                    {"sku": "TEST-001", "quantity": 2},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.json()["error"]["code"], "VALIDATION_ERROR")

    def test_order_lifecycle_and_stock(self):
        # Stock: TEST-001 has 50, TEST-002 has 5
        order_payload = {
            "dealer_id": self.dealer.id,
            "items": [{"sku": "TEST-001", "quantity": 10}],
        }
        res = self.client.post("/api/orders/", order_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_no = res.json()["order_number"]

        # DRAFT has no effect on stock
        self.assertEqual(Product.objects.get(sku="TEST-001").stock, 50)

        # Confirm order
        confirm_res = self.client.post(f"/api/orders/{order_no}/confirm/")
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)
        self.assertEqual(confirm_res.json()["status"], "CONFIRMED")

        # Stock deducted to 40
        self.assertEqual(Product.objects.get(sku="TEST-001").stock, 40)

        # Cannot edit confirmed order -> 409 ORDER_LOCKED
        put_res = self.client.put(
            f"/api/orders/{order_no}/",
            {"items": [{"sku": "TEST-001", "quantity": 5}]},
            format="json",
        )
        self.assertEqual(put_res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(put_res.json()["error"]["code"], "ORDER_LOCKED")

        # Cancel confirmed order -> restores stock
        cancel_res = self.client.post(f"/api/orders/{order_no}/cancel/")
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_res.json()["status"], "CANCELLED")
        self.assertEqual(Product.objects.get(sku="TEST-001").stock, 50)

        # Cannot cancel again -> 409 INVALID_TRANSITION
        cancel_again = self.client.post(f"/api/orders/{order_no}/cancel/")
        self.assertEqual(cancel_again.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(cancel_again.json()["error"]["code"], "INVALID_TRANSITION")

    def test_insufficient_stock_error(self):
        # TEST-002 has stock 5, try to order 10
        order_payload = {
            "dealer_id": self.dealer.id,
            "items": [{"sku": "TEST-002", "quantity": 10}],
        }
        res = self.client.post("/api/orders/", order_payload, format="json")
        order_no = res.json()["order_number"]

        confirm_res = self.client.post(f"/api/orders/{order_no}/confirm/")
        self.assertEqual(confirm_res.status_code, status.HTTP_409_CONFLICT)
        err = confirm_res.json()["error"]
        self.assertEqual(err["code"], "INSUFFICIENT_STOCK")
        self.assertTrue(len(err["details"]) > 0)
        self.assertEqual(err["details"][0]["sku"], "TEST-002")
        self.assertEqual(err["details"][0]["requested"], 10)
        self.assertEqual(err["details"][0]["available"], 5)
        # Stock untouched
        self.assertEqual(Product.objects.get(sku="TEST-002").stock, 5)

    def test_order_idempotency_header(self):
        order_payload = {
            "dealer_id": self.dealer.id,
            "items": [{"sku": "TEST-001", "quantity": 2}],
        }
        res1 = self.client.post(
            "/api/orders/",
            order_payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY="key-123",
        )
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        order1 = res1.json()

        # Replay same payload with same key
        res2 = self.client.post(
            "/api/orders/",
            order_payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY="key-123",
        )
        self.assertIn(res2.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertEqual(res2.json()["order_number"], order1["order_number"])

        # Replay different payload with same key -> 409 IDEMPOTENCY_CONFLICT
        different_payload = {
            "dealer_id": self.dealer.id,
            "items": [{"sku": "TEST-001", "quantity": 5}],
        }
        res3 = self.client.post(
            "/api/orders/",
            different_payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY="key-123",
        )
        self.assertEqual(res3.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res3.json()["error"]["code"], "IDEMPOTENCY_CONFLICT")


class ForecastingAndReorderTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_forecast_sku_endpoint(self):
        res = self.client.get("/api/forecast/FIL-1016/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["sku"], "FIL-1016")
        self.assertIn("forecast", data)
        self.assertEqual(len(data["forecast"]), 4)
        weeks = [x["week_start"] for x in data["forecast"]]
        self.assertEqual(weeks, ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"])

    def test_forecast_unknown_sku_404(self):
        res = self.client.get("/api/forecast/NONEXISTENT-999/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(res.json()["error"]["code"], "NOT_FOUND")

    def test_reorder_suggestions_endpoint(self):
        # Seed an inventory record
        p = Product.objects.create(
            sku="FIL-1016",
            name="Filter Test",
            category="Filters",
            brand="Mahle",
            vehicle_fitment="Universal",
            price=Decimal("450.00"),
        )
        Inventory.objects.create(product=p, quantity=25, reason="test")

        res = self.client.get("/api/reorder-suggestions/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertIn("results", data)
        self.assertEqual(len(data["results"]), 40)

        entry = next(r for r in data["results"] if r["sku"] == "FIL-1016")
        for k in ("sku", "current_stock", "lead_time_weeks", "lead_time_demand", "safety_stock", "reorder_point", "reorder_qty"):
            self.assertIn(k, entry)
        self.assertEqual(entry["current_stock"], 25)
        self.assertGreater(entry["lead_time_demand"], 0)
        self.assertGreaterEqual(entry["safety_stock"], 0)
        self.assertGreaterEqual(entry["reorder_qty"], 0)


class SupplierSyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_supplier_sync_success_mocked(self):
        from unittest.mock import patch

        fake_feed = [
            {
                "supplier_sku": "SUP-101",
                "sku": "SYNC-001",
                "name": "Sync Test Part",
                "category": "Brakes",
                "brand": "Endurance",
                "vehicle_fitment": "Universal",
                "description": "Test part",
                "price": "500.00",
                "supplier_stock": 200,
                "updated_at": "2026-10-10T10:00:00Z",
            },
            {
                "supplier_sku": "SUP-102",
                "sku": "SYNC-001",
                "name": "Sync Test Part Updated",
                "category": "Brakes",
                "brand": "Endurance",
                "vehicle_fitment": "Universal",
                "description": "Test part updated description",
                "price": "550.00",
                "supplier_stock": 250,
                "updated_at": "2026-10-10T11:00:00Z",  # Later -> should be selected
            },
            {
                "supplier_sku": "SUP-103",
                "sku": "",  # Invalid SKU -> rejected
                "name": "Invalid Part",
                "price": "100.00",
            },
            {
                "supplier_sku": "SUP-104",
                "sku": "SYNC-002",
                "name": "Invalid Price Part",
                "price": "-50.00",  # Negative price -> rejected
            },
        ]

        with patch("core.supplier_service.fetch_supplier_feed", return_value=(fake_feed, 1, 1)):
            res = self.client.post("/api/sync/supplier/")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            data = res.json()
            self.assertEqual(data["created"], 1)
            self.assertEqual(data["updated"], 0)
            self.assertEqual(data["unchanged"], 0)
            self.assertEqual(len(data["rejected"]), 2)

            # Check created product in DB
            prod = Product.objects.get(sku="SYNC-001")
            self.assertEqual(prod.name, "Sync Test Part Updated")
            self.assertEqual(prod.price, Decimal("550.00"))
            self.assertEqual(prod.stock, 0)  # Stock untouched

            # Re-run same feed -> idempotent: 0 created, 0 updated, 1 unchanged
            res2 = self.client.post("/api/sync/supplier/")
            self.assertEqual(res2.status_code, status.HTTP_200_OK)
            data2 = res2.json()
            self.assertEqual(data2["created"], 0)
            self.assertEqual(data2["updated"], 0)
            self.assertEqual(data2["unchanged"], 1)

    def test_supplier_sync_failure_502(self):
        from unittest.mock import patch
        from core.supplier_service import SupplierUnavailableError

        with patch("core.supplier_service.fetch_supplier_feed", side_effect=SupplierUnavailableError("Failed to connect")):
            res = self.client.post("/api/sync/supplier/")
            self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
            self.assertEqual(res.json()["error"]["code"], "SUPPLIER_UNAVAILABLE")


class DealerAssistantTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dealer = Dealer.objects.create(
            dealer_code="DLR-ASST-01",
            name="Assistant Test Dealer",
            credit_limit=Decimal("50000.00"),
        )
        self.p = Product.objects.create(
            sku="BRK-1044",
            name="Endurance Brake Pad Set - Bajaj Pulsar 150",
            category="Brakes",
            brand="Endurance",
            vehicle_fitment="Bajaj Pulsar 150",
            price=Decimal("1459.50"),
            description="Brake pads for Bajaj Pulsar 150",
        )
        Inventory.objects.create(product=self.p, quantity=50, reason="test init")

    def test_assistant_chat_search_flow(self):
        payload = {
            "session_id": "test-session-101",
            "dealer_id": self.dealer.id,
            "message": "Do you have brake pads for a Bajaj Pulsar 150?",
        }
        res = self.client.post("/api/assistant/chat/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertIn("reply", data)
        self.assertIn("cited_skus", data)
        self.assertIn("tool_calls", data)
        self.assertIn("actions", data)
        self.assertIn("BRK-1044", data["cited_skus"])
        self.assertTrue(any(tc["name"] == "search_parts" for tc in data["tool_calls"]))

    def test_assistant_chat_draft_order_flow(self):
        payload = {
            "session_id": "test-session-102",
            "dealer_id": self.dealer.id,
            "message": "Please create draft order for 3 units of BRK-1044",
        }
        res = self.client.post("/api/assistant/chat/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertIn("BRK-1044", data["cited_skus"])
        self.assertTrue(any(tc["name"] == "create_draft_order" for tc in data["tool_calls"]))
        self.assertEqual(len(data["actions"]), 1)
        action = data["actions"][0]
        self.assertEqual(action["type"], "draft_order_created")
        self.assertTrue(action["order_number"].startswith("ORD-"))

        # Verify order in DB is DRAFT
        order = Order.objects.get(order_number=action["order_number"])
        self.assertEqual(order.status, Order.STATUS_DRAFT)
        self.assertEqual(order.dealer_id, self.dealer.id)
        # Stock untouched
        self.assertEqual(Product.objects.get(sku="BRK-1044").stock, 50)

    def test_assistant_chat_ambiguity_clarification(self):
        payload = {
            "session_id": "test-session-103",
            "dealer_id": self.dealer.id,
            "message": "Do you have brake pads?",  # No bike specified
        }
        res = self.client.post("/api/assistant/chat/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        # Should ask clarifying question
        self.assertIn("model", data["reply"].lower())
