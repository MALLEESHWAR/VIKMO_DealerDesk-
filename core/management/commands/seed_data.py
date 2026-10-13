import csv
from decimal import Decimal
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import (
    AssistantSessionMessage,
    DailyOrderSequence,
    Dealer,
    Inventory,
    Order,
    OrderItem,
    Product,
)


class Command(BaseCommand):
    help = "Load the files in data/ into the database. Must be safe to run more than once."

    def handle(self, *args, **options):
        data_dir = Path(settings.DATA_DIR)
        catalogue_path = data_dir / "catalogue.csv"
        dealers_path = data_dir / "dealers.csv"

        if not catalogue_path.exists():
            self.stderr.write(self.style.ERROR(f"catalogue.csv not found at {catalogue_path}"))
            return

        if not dealers_path.exists():
            self.stderr.write(self.style.ERROR(f"dealers.csv not found at {dealers_path}"))
            return

        with transaction.atomic():
            # Clean up existing test orders so re-seeding restores a clean slate
            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            DailyOrderSequence.objects.all().delete()
            AssistantSessionMessage.objects.all().delete()

            # Seed Products and Inventory
            seeded_skus = set()
            prods_created = 0
            prods_updated = 0
            with open(catalogue_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    sku = row["sku"].strip()
                    seeded_skus.add(sku)
                    name = row["name"].strip()
                    category = row["category"].strip()
                    brand = row["brand"].strip()
                    vehicle_fitment = row["vehicle_fitment"].strip()
                    price = Decimal(row["price"].strip())
                    stock = int(row["stock"].strip())
                    description = row["description"].strip()

                    product, created = Product.objects.update_or_create(
                        sku=sku,
                        defaults={
                            "name": name,
                            "category": category,
                            "brand": brand,
                            "vehicle_fitment": vehicle_fitment,
                            "price": price,
                            "description": description,
                        },
                    )

                    Inventory.objects.update_or_create(
                        product=product,
                        defaults={
                            "quantity": stock,
                            "reason": "initial seed",
                        },
                    )

                    if created:
                        prods_created += 1
                    else:
                        prods_updated += 1

            # Remove any test products created outside data/
            Product.objects.exclude(sku__in=seeded_skus).delete()

            # Seed Dealers
            seeded_dealer_codes = set()
            dealers_created = 0
            dealers_updated = 0
            with open(dealers_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    dealer_code = row["dealer_code"].strip()
                    seeded_dealer_codes.add(dealer_code)
                    name = row["name"].strip()
                    city = row.get("city", "").strip()
                    phone = row.get("phone", "").strip()
                    email = row.get("email", "").strip()
                    gstin = row.get("gstin", "").strip()
                    credit_limit = Decimal(row["credit_limit"].strip()) if "credit_limit" in row else Decimal("0.00")

                    _, created = Dealer.objects.update_or_create(
                        dealer_code=dealer_code,
                        defaults={
                            "name": name,
                            "city": city,
                            "phone": phone,
                            "email": email,
                            "gstin": gstin,
                            "credit_limit": credit_limit,
                        },
                    )
                    if created:
                        dealers_created += 1
                    else:
                        dealers_updated += 1

            # Remove any test dealers created outside data/
            Dealer.objects.exclude(dealer_code__in=seeded_dealer_codes).delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded data: "
                f"Products: {prods_created} created, {prods_updated} updated (Total: {Product.objects.count()}). "
                f"Dealers: {dealers_created} created, {dealers_updated} updated (Total: {Dealer.objects.count()})."
            )
        )
