from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

# ── SIP credential pool ──────────────────────────────────────────────────────
# Keyed by phone number (E.164 without the leading '+').
# In production these would live in the database, assigned per user on signup.
_CREDENTIALS: dict[str, dict] = {
    '263711111111': {   # test customer
        'sip_username': '2638612166751',
        'sip_password': 'Wz-8jygE7XRSlosd',
        'sip_domain':   'sip.kmgconnect.com',
        'sip_server':   'sip.kmgconnect.com',
        'wss_url':      'wss://sip.kmgconnect.com:8089/ws',
    },
    '263722222222': {   # test provider
        'sip_username': '2638612166752',
        'sip_password': 'YAHtXXaeA5PaUh0H',
        'sip_domain':   'sip.kmgconnect.com',
        'sip_server':   'sip.kmgconnect.com',
        'wss_url':      'wss://sip.kmgconnect.com:8089/ws',
    },
    '263771000000': {   # test admin
        'sip_username': '2638612166750',
        'sip_password': 'MnXBrEcLYy3OsNJJ',
        'sip_domain':   'sip.kmgconnect.com',
        'sip_server':   'sip.kmgconnect.com',
        'wss_url':      'wss://sip.kmgconnect.com:8089/ws',
    },
}

# Fallback / shared extension for unmapped users (test only)
_DEFAULT_CREDS: dict = {
    'sip_username': '2638612166753',
    'sip_password': '652Nh0s7Sj$X6Y/z',
    'sip_domain':   'sip.kmgconnect.com',
    'sip_server':   'sip.kmgconnect.com',
    'wss_url':      'wss://sip.kmgconnect.com:8089/ws',
}


@router.get('/credentials', summary='Get SIP credentials for the current user')
async def get_voip_credentials(current_user: User = Depends(get_current_user)):
    """Return the SIP credentials assigned to the authenticated user."""
    phone = current_user.phone.lstrip('+')
    creds = _CREDENTIALS.get(phone, _DEFAULT_CREDS).copy()
    creds['display_name'] = f'{current_user.first_name} {current_user.last_name}'.strip()
    return creds
