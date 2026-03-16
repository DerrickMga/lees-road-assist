"""
Pusher Beams Auth endpoint — required for authenticated device interests.
"""
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.user import User
from app.services.push import generate_auth_token

router = APIRouter()


@router.get("/beams/auth")
async def beams_auth(user: User = Depends(get_current_user)):
    """
    Returns a Pusher Beams token for the authenticated user.
    The mobile/web app must call this endpoint and pass the token to beamsClient.
    """
    token = generate_auth_token(user.id)
    return token
