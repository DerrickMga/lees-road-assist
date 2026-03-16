#!/usr/bin/env python3
"""
seed_data.py — Populate the database with essential test / reference data.

Creates:
  - 4 Service categories
  - 8 Service types with pricing rules
  - 3 Subscription plans
  - Super-admin user (phone: +26377XXXXXXX / password: Admin@1234)
  - Test customer  (phone: +26371TEST000 / password: Test@1234)
  - Test provider  (phone: +26372TEST001 / password: Test@1234)

Usage (from backend/ directory):
    python scripts/seed_data.py

Run create_db.py first.
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))


async def seed():
    from sqlalchemy import select
    from passlib.context import CryptContext

    from app.core.database import async_session
    from app.models.user import User, UserRole, UserStatus
    from app.models.service import ServiceCategory, ServiceType, PricingRule
    from app.models.subscription import SubscriptionPlan
    from app.models.provider import ProviderProfile, ProfileStatus, ProviderType

    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

    async with async_session() as session:
        # ── Service Categories ──────────────────────────────────────────────
        categories_data = [
            {"name": "Roadside Assistance", "code": "roadside", "description": "On-the-spot vehicle repairs and assistance"},
            {"name": "Towing",              "code": "towing",   "description": "Vehicle recovery and towing services"},
            {"name": "Battery Services",    "code": "battery",  "description": "Battery testing, jump-starts and replacement"},
            {"name": "Fuel Delivery",       "code": "fuel",     "description": "Emergency fuel delivery to your location"},
        ]

        category_ids: dict[str, int] = {}
        for cd in categories_data:
            result = await session.execute(select(ServiceCategory).where(ServiceCategory.code == cd["code"]))
            cat = result.scalar_one_or_none()
            if not cat:
                cat = ServiceCategory(is_active=True, **cd)
                session.add(cat)
                await session.flush()
                print(f"  + Category: {cat.name}")
            category_ids[cat.code] = cat.id

        # ── Service Types + Pricing Rules ──────────────────────────────────
        # Pricing: $5 service fee + callout ($5/<5km  $8/5-10km  $10/>10km) + $2.50/km towing
        services_data = [
            {"name": "Flat Tyre Change",    "category_code": "roadside", "code": "flat_tyre",      "tow": False},
            {"name": "Battery Jump Start",  "category_code": "battery",  "code": "battery_jump",   "tow": False},
            {"name": "Battery Replacement", "category_code": "battery",  "code": "battery_replace", "tow": False},
            {"name": "Fuel Delivery",       "category_code": "fuel",     "code": "fuel_delivery",   "tow": False},
            {"name": "Vehicle Lockout",     "category_code": "roadside", "code": "lockout",         "tow": False},
            {"name": "General Towing",      "category_code": "towing",   "code": "gen_towing",      "tow": True},
            {"name": "Accident Recovery",   "category_code": "towing",   "code": "accident_rec",    "tow": True},
            {"name": "Off-Road Recovery",   "category_code": "roadside", "code": "offroad_rec",     "tow": False},
        ]
        # Three distance bands: (min_km, max_km | None, callout_fee)
        BANDS = [(0.0, 5.0, 5.0), (5.0, 10.0, 8.0), (10.0, None, 10.0)]
        SERVICE_FEE = 5.0
        TOWING_PER_KM = 2.50

        for sd in services_data:
            result = await session.execute(select(ServiceType).where(ServiceType.code == sd["code"]))
            stype = result.scalar_one_or_none()
            if not stype:
                stype = ServiceType(
                    name=sd["name"],
                    code=sd["code"],
                    category_id=category_ids.get(sd["category_code"]),
                    is_active=True,
                    requires_tow_vehicle=sd["tow"],
                    estimated_duration_minutes=45 if sd["tow"] else 30,
                )
                session.add(stype)
                await session.flush()
                print(f"  + Service type: {stype.name}")

            for (mn, mx, callout) in BANDS:
                q = select(PricingRule).where(
                    PricingRule.service_type_id == stype.id,
                    PricingRule.min_distance_km == mn,
                )
                if not (await session.execute(q)).scalar_one_or_none():
                    session.add(PricingRule(
                        service_type_id=stype.id,
                        pricing_model="tiered",
                        base_amount=SERVICE_FEE + callout,
                        per_km_amount=TOWING_PER_KM if sd["tow"] else 0.0,
                        min_distance_km=mn,
                        max_distance_km=mx,
                        currency="USD",
                        is_active=True,
                    ))
            print(f"    + Pricing rules (3 bands) for: {stype.name}")

        # ── Subscription Plans ─────────────────────────────────────────────
        plans_data = [
            {"name": "Basic Monthly",      "code": "basic_monthly",      "billing_cycle": "monthly", "price": 9.99,   "included_callouts": 3,    "towing_discount_percent": 0.0,  "features_json": {"priority_dispatch": False}},
            {"name": "Basic Annual",       "code": "basic_annual",       "billing_cycle": "annual",  "price": 99.99,  "included_callouts": 36,   "towing_discount_percent": 0.0,  "features_json": {"priority_dispatch": False}},
            {"name": "Premium Monthly",    "code": "premium_monthly",    "billing_cycle": "monthly", "price": 19.99,  "included_callouts": 10,   "towing_discount_percent": 10.0, "features_json": {"priority_dispatch": True}},
            {"name": "Premium Annual",     "code": "premium_annual",     "billing_cycle": "annual",  "price": 199.99, "included_callouts": 120,  "towing_discount_percent": 10.0, "features_json": {"priority_dispatch": True}},
            {"name": "Enterprise Monthly", "code": "enterprise_monthly", "billing_cycle": "monthly", "price": 49.99,  "included_callouts": 999,  "towing_discount_percent": 20.0, "features_json": {"priority_dispatch": True, "fleet": True}},
            {"name": "Enterprise Annual",  "code": "enterprise_annual",  "billing_cycle": "annual",  "price": 499.99, "included_callouts": 9999, "towing_discount_percent": 20.0, "features_json": {"priority_dispatch": True, "fleet": True}},
        ]

        for pd in plans_data:
            result = await session.execute(select(SubscriptionPlan).where(SubscriptionPlan.code == pd["code"]))
            if not result.scalar_one_or_none():
                plan = SubscriptionPlan(is_active=True, **pd)
                session.add(plan)
                print(f"  + Plan: {plan.name}")

        # ── Users ──────────────────────────────────────────────────────────
        users_to_create = [
            {"first_name": "Lee",  "last_name": "Admin",    "phone": "+263771000000", "email": "admin@leesexpress.co.zw", "password": "Admin@1234", "role": UserRole.SUPER_ADMIN},
            {"first_name": "Test", "last_name": "Customer", "phone": "+263711111111", "email": "customer@test.com",       "password": "Test@1234",  "role": UserRole.CUSTOMER},
            {"first_name": "Test", "last_name": "Provider", "phone": "+263722222222", "email": "provider@test.com",       "password": "Test@1234",  "role": UserRole.PROVIDER},
        ]

        provider_user_id = None
        for ud in users_to_create:
            result = await session.execute(
                select(User).where(User.phone == ud["phone"])
            )
            user = result.scalar_one_or_none()
            if not user:
                user = User(
                    first_name=ud["first_name"],
                    last_name=ud["last_name"],
                    phone=ud["phone"],
                    email=ud["email"],
                    password_hash=pwd_ctx.hash(ud["password"]),
                    role=ud["role"],
                    status=UserStatus.ACTIVE,
                    is_phone_verified=True,
                )
                session.add(user)
                await session.flush()
                print(f"  + User: {user.first_name} {user.last_name} ({user.role.value})")
            if ud["role"] == UserRole.PROVIDER:
                provider_user_id = user.id

        # Auto-create ProviderProfile for test provider
        if provider_user_id:
            result = await session.execute(
                select(ProviderProfile).where(ProviderProfile.user_id == provider_user_id)
            )
            if not result.scalar_one_or_none():
                session.add(ProviderProfile(
                    user_id=provider_user_id,
                    business_name="Test Provider Services",
                    provider_type=ProviderType.INDIVIDUAL,
                    profile_status=ProfileStatus.APPROVED,
                    average_rating=0.0,
                    total_jobs_completed=0,
                ))
                print("  + ProviderProfile for test provider")

        await session.commit()

    print()
    print("🌱  Seed data committed.")
    print()
    print("  Login credentials:")
    print("  ┌──────────────────┬──────────────────────┬────────────────┐")
    print("  │ Role             │ Phone                │ Password       │")
    print("  ├──────────────────┼──────────────────────┼────────────────┤")
    print("  │ super_admin      │ +263771000000        │ Admin@1234     │")
    print("  │ customer         │ +263711111111        │ Test@1234      │")
    print("  │ provider         │ +263722222222        │ Test@1234      │")
    print("  └──────────────────┴──────────────────────┴────────────────┘")


def main():
    print("=" * 55)
    print("  Lee's Express Courier — Seed Data")
    print("=" * 55)
    asyncio.run(seed())


if __name__ == "__main__":
    main()
