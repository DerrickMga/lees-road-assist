import asyncio
import logging
import smtplib
import uuid
from pathlib import Path
from email.message import EmailMessage

import httpx

from app.core.config import get_settings
from app.models.user import User


logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("app.otp_audit")
settings = get_settings()


class OTPDeliveryError(RuntimeError):
    pass


def _audit(
    otp_code: str,
    purpose: str,
    channel: str,
    status: str,
    phone_or_email: str,
    user: User | None = None,
    detail: str | None = None,
) -> None:
    safe_code = f"***{otp_code[-3:]}" if otp_code else "***"
    message = (
        "OTP_AUDIT status=%s channel=%s purpose=%s target=%s otp=%s user_id=%s role=%s email=%s detail=%s"
        % (
            status,
            channel,
            purpose,
            phone_or_email,
            safe_code,
            user.id if user else "-",
            user.role.value if user else "-",
            user.email if user and user.email else "-",
            detail or "-",
        )
    )
    if status == "success":
        audit_logger.info(message)
    else:
        audit_logger.error(message)


def _is_email(value: str) -> bool:
    return "@" in value


def _normalize_whatsapp_number(phone: str) -> str:
    digits = "".join(char for char in phone if char.isdigit())
    if phone.strip().startswith("+"):
        return digits
    if digits.startswith("00"):
        return digits[2:]
    return digits


def _purpose_label(purpose: str) -> str:
    labels = {
        "registration": "registration",
        "verify_phone": "verification",
        "login": "login",
        "password_reset": "password reset",
    }
    return labels.get(purpose, purpose.replace("_", " "))


def _build_otp_message(otp_code: str, purpose: str) -> str:
    label = _purpose_label(purpose)
    return (
        f"Your Lee's Express Courier {label} code is {otp_code}. "
        f"It expires in {settings.otp_expire_minutes} minutes. "
        "If you did not request this code, ignore this message."
    )


def _send_email_sync(recipient: str, otp_code: str, purpose: str, user: User | None = None) -> str:
    if not settings.smtp_from_email:
        _audit(otp_code, purpose, "email", "failure", recipient, user, "smtp-not-configured")
        raise OTPDeliveryError("SMTP is not configured")

    message = EmailMessage()
    message["Subject"] = f"Your Lee's Express Courier {_purpose_label(purpose).title()} Code"
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = recipient
    message.set_content(_build_otp_message(otp_code, purpose))

    if settings.smtp_pickup_directory:
        pickup_dir = Path(settings.smtp_pickup_directory)
        pickup_dir.mkdir(parents=True, exist_ok=True)
        filename = pickup_dir / f"otp-{uuid.uuid4().hex}.eml"
        filename.write_bytes(message.as_bytes())
        logger.info("OTP email written to SMTP pickup directory for %s", recipient)
        _audit(otp_code, purpose, "email", "success", recipient, user, f"pickup={filename.name}")
        return "email"

    if not settings.smtp_host:
        _audit(otp_code, purpose, "email", "failure", recipient, user, "smtp-host-missing")
        raise OTPDeliveryError("SMTP host is not configured")

    try:
        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)
    except smtplib.SMTPException as exc:
        _audit(otp_code, purpose, "email", "failure", recipient, user, str(exc))
        raise OTPDeliveryError(f"Email delivery failed: {exc}") from exc

    logger.info("OTP delivered by email to %s", recipient)
    _audit(otp_code, purpose, "email", "success", recipient, user)
    return "email"


def _send_whatsapp_sync(phone: str, otp_code: str, purpose: str, user: User | None = None) -> str:
    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        _audit(otp_code, purpose, "whatsapp", "failure", phone, user, "whatsapp-not-configured")
        raise OTPDeliveryError("WhatsApp Cloud API is not configured")

    to_number = _normalize_whatsapp_number(phone)
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_number,
        "type": "text",
        "text": {"preview_url": False, "body": _build_otp_message(otp_code, purpose)},
    }
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }
    url = f"{settings.whatsapp_api_url}/{settings.whatsapp_phone_number_id}/messages"

    with httpx.Client(timeout=20) as client:
        response = client.post(url, headers=headers, json=payload)

    if response.status_code >= 400:
        logger.error("WhatsApp OTP delivery failed for %s: %s", phone, response.text)
        _audit(otp_code, purpose, "whatsapp", "failure", phone, user, response.text)
        raise OTPDeliveryError(f"WhatsApp delivery failed: {response.text}")

    logger.info("OTP delivered by WhatsApp to %s", phone)
    _audit(otp_code, purpose, "whatsapp", "success", phone, user)
    return "whatsapp"


def send_otp_sync(phone_or_email: str, otp_code: str, purpose: str, user: User | None = None) -> str:
    if _is_email(phone_or_email):
        return _send_email_sync(phone_or_email, otp_code, purpose, user)

    try:
        return _send_whatsapp_sync(phone_or_email, otp_code, purpose, user)
    except OTPDeliveryError:
        if user and user.role.value == "provider" and user.email and settings.smtp_host and settings.smtp_from_email:
            logger.warning(
                "WhatsApp delivery failed for %s, falling back to email %s",
                phone_or_email,
                user.email,
            )
            _audit(otp_code, purpose, "email", "attempt", user.email, user, "provider-fallback-after-whatsapp")
            return _send_email_sync(user.email, otp_code, purpose, user)
        raise


async def send_otp(phone_or_email: str, otp_code: str, purpose: str, user: User | None = None) -> str:
    return await asyncio.to_thread(send_otp_sync, phone_or_email, otp_code, purpose, user)