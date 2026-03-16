import math
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.service import ServiceType, PricingRule

# --- Lee's Express Courier Standard Pricing ---
# Service fee: flat $5
SERVICE_FEE = 5.0

# Call-out fee by distance band (from flyer)
CALLOUT_BANDS = [
    (0.0, 5.0, 5.0),     # within 5 km  → $5
    (5.0, 10.0, 8.0),    # 5–10 km      → $8
    (10.0, float("inf"), 10.0),  # 10+ km → $10
]

# Per-km rate for towing (on top of callout + service fee)
TOWING_PER_KM = 2.50


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_callout_fee(distance_km: float) -> float:
    for low, high, fee in CALLOUT_BANDS:
        if low <= distance_km < high:
            return fee
    return CALLOUT_BANDS[-1][2]


async def calculate_price(
    db: AsyncSession,
    service_type_id: int,
    pickup_lat: float,
    pickup_lng: float,
    dest_lat: float | None = None,
    dest_lng: float | None = None,
    provider_lat: float | None = None,
    provider_lng: float | None = None,
    promo_discount: float = 0.0,
) -> dict:
    """Calculate estimated price for a service request using Lee's pricing."""

    # Distance from provider to customer (for callout band)
    dispatch_distance = 0.0
    if provider_lat and provider_lng:
        dispatch_distance = _haversine_km(provider_lat, provider_lng, pickup_lat, pickup_lng)

    callout_fee = get_callout_fee(dispatch_distance)

    # Towing cost
    towing_distance = 0.0
    towing_cost = 0.0
    if dest_lat and dest_lng:
        towing_distance = _haversine_km(pickup_lat, pickup_lng, dest_lat, dest_lng)
        towing_cost = towing_distance * TOWING_PER_KM

    # Check for DB pricing rule override
    result = await db.execute(
        select(PricingRule).where(
            PricingRule.service_type_id == service_type_id,
            PricingRule.is_active == True,
        ).limit(1)
    )
    rule = result.scalar_one_or_none()
    if rule and rule.base_amount > 0:
        service_fee = rule.base_amount
        if rule.per_km_amount and towing_distance > 0:
            towing_cost = towing_distance * rule.per_km_amount
    else:
        service_fee = SERVICE_FEE

    subtotal = service_fee + callout_fee + towing_cost
    discount = promo_discount
    total = max(subtotal - discount, 0)

    return {
        "service_fee": round(service_fee, 2),
        "callout_fee": round(callout_fee, 2),
        "dispatch_distance_km": round(dispatch_distance, 2),
        "towing_distance_km": round(towing_distance, 2),
        "towing_cost": round(towing_cost, 2),
        "subtotal": round(subtotal, 2),
        "discount": round(discount, 2),
        "total": round(total, 2),
        "currency": "USD",
    }
