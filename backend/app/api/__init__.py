from fastapi import APIRouter
from app.api.routes import (
    auth, profile, vehicles, services, requests, providers,
    dispatch, payments, ratings, notifications, support,
    subscriptions, towing, tracking, admin, whatsapp, websocket, push, voip,
)

api_router = APIRouter()

# Auth & profile
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(profile.router, prefix="/profile", tags=["Profile"])

# Core resources
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
api_router.include_router(services.router, prefix="/services", tags=["Services"])
api_router.include_router(requests.router, prefix="/requests", tags=["Service Requests"])

# Provider
api_router.include_router(providers.router, prefix="/providers", tags=["Providers"])

# Dispatch
api_router.include_router(dispatch.router, prefix="/dispatch", tags=["Dispatch"])

# Payments & wallet
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])

# Ratings & quality
api_router.include_router(ratings.router, prefix="/ratings", tags=["Ratings"])

# Notifications
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])

# Support & incidents
api_router.include_router(support.router, prefix="/support", tags=["Support"])

# Subscriptions
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["Subscriptions"])

# Towing
api_router.include_router(towing.router, prefix="/towing", tags=["Towing"])

# Live tracking & ETA
api_router.include_router(tracking.router, prefix="/tracking", tags=["Tracking"])

# Admin & analytics
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])

# WhatsApp webhook & messaging
api_router.include_router(whatsapp.router, prefix="/whatsapp", tags=["WhatsApp"])

# WebSocket
api_router.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])

# Pusher Beams auth
api_router.include_router(push.router, prefix="/pusher", tags=["Push Notifications"])

# VoIP / SIP credentials
api_router.include_router(voip.router, prefix="/voip", tags=["VoIP"])
