"""
Pusher Beams — Push Notification Service
Instance: 11f71819-94b7-4a5b-abe5-5a1245fde4bc

Usage:
    await push.notify_user(user_id=123, title="Your provider is on the way!", body="ETA 5 mins")
    await push.notify_interest("request-456", title="Status Update", body="Job completed")
"""

import logging
from app.core.config import get_settings

logger = logging.getLogger("push_notifications")
settings = get_settings()


def _get_beams_client():
    try:
        from pusher_push_notifications import PushNotifications
        return PushNotifications(
            instance_id=settings.pusher_beams_instance_id,
            secret_key=settings.pusher_beams_secret_key,
        )
    except Exception as e:
        logger.warning(f"Pusher Beams client init failed: {e}")
        return None


def notify_user(
    user_id: int,
    title: str,
    body: str,
    data: dict | None = None,
    deep_link: str | None = None,
) -> bool:
    """
    Send a push notification to a specific user via their Beams user_id interest.
    Interest name: "user-{user_id}"
    """
    client = _get_beams_client()
    if not client:
        return False

    try:
        notification = {
            "apns": {
                "aps": {
                    "alert": {"title": title, "body": body},
                    "sound": "default",
                }
            },
            "fcm": {
                "notification": {"title": title, "body": body},
                "data": data or {},
            },
            "web": {
                "notification": {"title": title, "body": body},
                "data": data or {},
            },
        }
        if deep_link:
            notification["fcm"]["data"]["deep_link"] = deep_link
            notification["web"]["data"]["deep_link"] = deep_link

        client.publish_to_interests(
            interests=[f"user-{user_id}"],
            publish_body=notification,
        )
        return True
    except Exception as e:
        logger.error(f"Pusher Beams notify_user failed for user {user_id}: {e}")
        return False


def notify_interest(
    interest: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """
    Broadcast a notification to any registered interest (e.g. 'dispatch-updates', 'request-{id}').
    """
    client = _get_beams_client()
    if not client:
        return False

    try:
        client.publish_to_interests(
            interests=[interest],
            publish_body={
                "apns": {"aps": {"alert": {"title": title, "body": body}, "sound": "default"}},
                "fcm": {"notification": {"title": title, "body": body}, "data": data or {}},
                "web": {"notification": {"title": title, "body": body}, "data": data or {}},
            },
        )
        return True
    except Exception as e:
        logger.error(f"Pusher Beams notify_interest '{interest}' failed: {e}")
        return False


def generate_auth_token(user_id: int) -> dict:
    """
    Generate a Beams auth token for a user (for authenticated notifications).
    Call from your /pusher/beams/auth endpoint.
    """
    client = _get_beams_client()
    if not client:
        return {}
    try:
        return client.generate_token(str(user_id))
    except Exception as e:
        logger.error(f"Pusher Beams token generation failed: {e}")
        return {}
