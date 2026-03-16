from celery import Celery
from app.core.config import get_settings
from app.services.otp_delivery import OTPDeliveryError, send_otp_sync

settings = get_settings()

celery_app = Celery(
    "lees_road_assist",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


@celery_app.task
def send_push_notification(user_id: str, title: str, body: str):
    """Send push notification via Firebase Cloud Messaging."""
    # TODO: Implement FCM push notification
    pass


@celery_app.task
def send_whatsapp_message(phone: str, template: str, params: dict):
    """Send WhatsApp message via Cloud API."""
    otp_code = params.get("otp_code")
    purpose = params.get("purpose", template)
    if not otp_code:
        raise OTPDeliveryError("otp_code is required for WhatsApp OTP delivery")
    return send_otp_sync(phone, otp_code, purpose)


@celery_app.task
def send_sms(phone: str, message: str):
    """Send SMS via gateway."""
    # TODO: Implement SMS gateway integration
    pass


@celery_app.task
def send_email_message(email: str, subject: str, params: dict):
    """Send email message for OTP delivery."""
    otp_code = params.get("otp_code")
    purpose = params.get("purpose", subject)
    if not otp_code:
        raise OTPDeliveryError("otp_code is required for email OTP delivery")
    return send_otp_sync(email, otp_code, purpose)
