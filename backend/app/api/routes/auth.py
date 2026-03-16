import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import get_settings
from app.api.deps import get_current_user
from app.models.user import User, UserRole, UserStatus, UserOTP
from app.models.customer import CustomerProfile
from app.schemas.user import (
    RegisterRequest, LoginRequest, SendOTPRequest, VerifyOTPRequest,
    ForgotPasswordRequest, ResetPasswordRequest, Token, UserOut,
)

router = APIRouter()
settings = get_settings()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.phone == payload.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number already registered")

    if payload.email:
        existing_email = await db.execute(select(User).where(User.email == payload.email))
        if existing_email.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    valid_roles = [r.value for r in UserRole]
    role = UserRole(payload.role) if payload.role in valid_roles else UserRole.CUSTOMER

    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
        status=UserStatus.ACTIVE,
        is_phone_verified=False,
    )
    db.add(user)
    await db.flush()

    # Auto-create customer profile for customer role
    if role == UserRole.CUSTOMER:
        db.add(CustomerProfile(user_id=user.id))

    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone == payload.phone))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.status in (UserStatus.SUSPENDED, UserStatus.BLOCKED):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended or blocked")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}


@router.post("/send-otp")
async def send_otp(payload: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expire_minutes)

    # Find user if exists
    user = None
    result = await db.execute(
        select(User).where(
            (User.phone == payload.phone_or_email) | (User.email == payload.phone_or_email)
        )
    )
    user = result.scalar_one_or_none()

    otp = UserOTP(
        user_id=user.id if user else None,
        phone_or_email=payload.phone_or_email,
        otp_code=otp_code,
        purpose=payload.purpose,
        expires_at=expires_at,
    )
    db.add(otp)
    await db.commit()

    # TODO: Send OTP via SMS/WhatsApp/email
    return {"message": "OTP sent", "expires_in_minutes": settings.otp_expire_minutes}


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserOTP).where(
            UserOTP.phone_or_email == payload.phone_or_email,
            UserOTP.otp_code == payload.otp_code,
            UserOTP.purpose == payload.purpose,
            UserOTP.used_at.is_(None),
            UserOTP.expires_at > datetime.now(timezone.utc),
        ).order_by(UserOTP.created_at.desc()).limit(1)
    )
    otp = result.scalar_one_or_none()
    if not otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")

    otp.used_at = datetime.now(timezone.utc)

    # Mark user phone as verified if applicable
    if otp.user_id:
        user_result = await db.execute(select(User).where(User.id == otp.user_id))
        user = user_result.scalar_one_or_none()
        if user:
            user.is_phone_verified = True
            user.status = UserStatus.ACTIVE

    await db.commit()
    return {"message": "OTP verified successfully", "verified": True}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    # Reuse send-otp logic
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expire_minutes)

    result = await db.execute(
        select(User).where(
            (User.phone == payload.phone_or_email) | (User.email == payload.phone_or_email)
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        # Don't reveal whether user exists
        return {"message": "If the account exists, a reset code has been sent"}

    otp = UserOTP(
        user_id=user.id,
        phone_or_email=payload.phone_or_email,
        otp_code=otp_code,
        purpose="password_reset",
        expires_at=expires_at,
    )
    db.add(otp)
    await db.commit()
    return {"message": "If the account exists, a reset code has been sent"}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserOTP).where(
            UserOTP.phone_or_email == payload.phone_or_email,
            UserOTP.otp_code == payload.otp_code,
            UserOTP.purpose == "password_reset",
            UserOTP.used_at.is_(None),
            UserOTP.expires_at > datetime.now(timezone.utc),
        ).order_by(UserOTP.created_at.desc()).limit(1)
    )
    otp = result.scalar_one_or_none()
    if not otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")

    otp.used_at = datetime.now(timezone.utc)

    user_result = await db.execute(
        select(User).where(
            (User.phone == payload.phone_or_email) | (User.email == payload.phone_or_email)
        )
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    await db.commit()
    return {"message": "Password reset successfully"}


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)
