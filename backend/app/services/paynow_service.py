"""
Paynow Zimbabwe payment gateway integration.

Paynow InitiateTransaction API:
  POST https://www.paynow.co.zw/Interface/InitiateTransaction
  Form-encoded body, SHA512 hash signature.

Supported mobile methods: ecocash, innbucks, onemoney
For mobile money, set `authemail` to the customer's phone number to trigger a
USSD push notification.
"""

import hashlib
import logging
from urllib.parse import parse_qs, urlencode

import httpx

logger = logging.getLogger(__name__)

PAYNOW_INIT_URL = "https://www.paynow.co.zw/Interface/InitiateTransaction"


def _paynow_hash(fields: list[str], integration_key: str) -> str:
    """
    SHA512 hash over concatenated field values + integration key (uppercase hex).

    Paynow hash formula:
        SHA512(id + reference + amount + additionalinfo + returnurl + resulturl
               + "Message" + integration_key)
    """
    raw = "".join(fields) + integration_key
    return hashlib.sha512(raw.encode("utf-8")).hexdigest().upper()


def _parse_paynow_response(response_text: str) -> dict[str, str]:
    """Parse Paynow's URL-encoded response into a plain dict."""
    parsed = parse_qs(response_text.strip(), keep_blank_values=True)
    return {k: v[0] for k, v in parsed.items()}


async def initiate_paynow(
    *,
    integration_id: str,
    integration_key: str,
    reference: str,
    amount: float,
    additional_info: str,
    return_url: str,
    result_url: str,
    authemail: str = "",
) -> dict:
    """
    Initiate a Paynow payment transaction.

    For regular (browser) payments, leave `authemail` empty — the response
    will contain a `browserurl` the customer should be redirected to.

    For mobile money (EcoCash, InnBucks, OneMoney), set `authemail` to the
    customer's mobile number to trigger a USSD push.

    Returns a dict:
        {
            "ok": bool,
            "status": str,           # "Ok" or "Error"
            "redirect_url": str,     # browser redirect URL (may be empty for mobile)
            "poll_url": str,         # poll URL to check payment status
            "error": str,            # error message if not ok
        }
    """
    amount_str = f"{amount:.2f}"

    # Build hash over these exact fields in this order
    hash_fields = [
        str(integration_id),
        reference,
        amount_str,
        additional_info,
        return_url,
        result_url,
        "Message",
    ]
    signature = _paynow_hash(hash_fields, integration_key)

    payload: dict[str, str] = {
        "id": str(integration_id),
        "reference": reference,
        "amount": amount_str,
        "additionalinfo": additional_info,
        "returnurl": return_url,
        "resulturl": result_url,
        "status": "Message",
        "hash": signature,
    }

    if authemail:
        payload["authemail"] = authemail

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                PAYNOW_INIT_URL,
                content=urlencode(payload),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            data = _parse_paynow_response(resp.text)
    except httpx.HTTPStatusError as exc:
        logger.error("Paynow HTTP error %s: %s", exc.response.status_code, exc.response.text)
        return {"ok": False, "status": "Error", "redirect_url": "", "poll_url": "", "error": f"HTTP {exc.response.status_code}"}
    except Exception as exc:
        logger.error("Paynow request failed: %s", exc)
        return {"ok": False, "status": "Error", "redirect_url": "", "poll_url": "", "error": str(exc)}

    paynow_status = data.get("status", "Error")
    if paynow_status.lower() != "ok":
        error_msg = data.get("error", "Unknown Paynow error")
        logger.warning("Paynow declined: %s | raw=%s", error_msg, data)
        return {"ok": False, "status": paynow_status, "redirect_url": "", "poll_url": "", "error": error_msg}

    return {
        "ok": True,
        "status": "Ok",
        "redirect_url": data.get("browserurl", ""),
        "poll_url": data.get("pollurl", ""),
        "error": "",
    }


async def poll_paynow_status(poll_url: str) -> dict:
    """
    Poll Paynow to check payment status.

    Returns a dict with keys: ok, status (Paid/Awaiting Delivery/etc.), error.
    """
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(poll_url)
            resp.raise_for_status()
            data = _parse_paynow_response(resp.text)
    except Exception as exc:
        logger.error("Paynow poll failed: %s", exc)
        return {"ok": False, "status": "Error", "paid": False, "error": str(exc)}

    paynow_status = data.get("status", "")
    paid = paynow_status.lower() in ("paid", "delivered")
    return {"ok": True, "status": paynow_status, "paid": paid, "error": ""}
