from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Lee's Express Courier"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    otp_expire_minutes: int = 10

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/lees_road_assist"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Google Maps & Directions
    google_maps_api_key: str = "AIzaSyCQtNU1ch_GhkDUperm6JyXPQQIlzZCddY"
    google_oauth_client_id: str = "458856444140-cdb5h76i2c0q6v5cmra2glibv20u1jm7.apps.googleusercontent.com"

    # VitalBot — WhatsApp chatbot gateway
    vitalbot_api_url: str = "https://bot2.kmgvitallinks.com/api"
    vitalbot_fallback_webhook: str = "https://bot2.kmgvitallinks.com/api/webhook"
    enable_webhook_routing: bool = True

    # WhatsApp Cloud API — Meta (Safenet Chatbot +263 8612 166749)
    whatsapp_api_provider: str = "meta"
    whatsapp_api_url: str = "https://graph.facebook.com/v21.0"
    whatsapp_phone_number_id: str = "849263908263815"
    whatsapp_access_token: str = ""
    whatsapp_waba_id: str = "2648363742184777"
    whatsapp_verify_token: str = "WL7LELgtIm20L3ZeflNA7kOF4f74zM6E"
    whatsapp_webhook_url: str = "https://bot2.kmgvitallinks.com/api/webhook"
    # WABA Flows (v6.1)
    whatsapp_flow_endpoint_url: str = ""
    whatsapp_customer_flow_id: str = ""
    whatsapp_provider_flow_id: str = ""

    # Internal service-to-service auth (WhatsApp bot → backend)
    internal_api_key: str = ""  # set BACKEND_API_KEY in bot .env to match this

    # Payments — Zimbabwe (Paynow → EcoCash, InnBucks, OneMoney)
    paynow_integration_id: str = "19948"
    paynow_integration_key: str = "535984f9-487d-41a2-b11a-9b5faf115fb5"
    paynow_return_url: str = "http://localhost:3000/payment/return"
    paynow_result_url: str = "http://localhost:8000/api/v1/payments/webhook/paynow"
    paynow_enabled_methods: str = "ecocash,innbucks,onemoney"  # comma-separated

    # Stripe (international cards)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Firebase Cloud Messaging (push notifications)
    firebase_credentials_path: str = "firebase-credentials.json"
    firebase_project_id: str = ""

    # Pusher Channels (real-time events)
    pusher_app_id: str = ""
    pusher_key: str = ""
    pusher_secret: str = ""
    pusher_cluster: str = "mt1"

    # Pusher Beams (push notifications)
    pusher_beams_instance_id: str = "11f71819-94b7-4a5b-abe5-5a1245fde4bc"
    pusher_beams_secret_key: str = "AD324E6CC01CC0ADC5E732A7BC224EAE4AD3A2968447E5E4B0D916A6F6D51B51"

    # SMS Gateway
    sms_api_key: str = ""
    sms_sender_id: str = "LeesExpress"

    # SMTP / Email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Lee's Express Courier"
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    smtp_pickup_directory: str = ""

    # Frontend URLs
    frontend_url: str = "http://localhost:3000"
    mobile_deep_link_scheme: str = "leesexpress"

    # Currency
    default_currency: str = "USD"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
