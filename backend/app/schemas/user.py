from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# --- Auth ---
class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: EmailStr | None = None
    password: str = Field(min_length=6)
    role: str = "customer"


class LoginRequest(BaseModel):
    phone: str
    password: str


class SendOTPRequest(BaseModel):
    phone_or_email: str
    purpose: str = "registration"  # registration, login, password_reset


class VerifyOTPRequest(BaseModel):
    phone_or_email: str
    otp_code: str
    purpose: str = "registration"


class ForgotPasswordRequest(BaseModel):
    phone_or_email: str


class ResetPasswordRequest(BaseModel):
    phone_or_email: str
    otp_code: str
    new_password: str = Field(min_length=6)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# --- User ---
class UserOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: str
    email: str | None = None
    role: str
    status: str
    is_phone_verified: bool
    is_email_verified: bool
    last_login_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None


# --- Customer Profile ---
class CustomerProfileCreate(BaseModel):
    date_of_birth: str | None = None
    national_id: str | None = None
    profile_photo_url: str | None = None
    address_line_1: str | None = None
    city: str | None = None
    country: str = "Zimbabwe"
    preferred_language: str = "en"
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None


class CustomerProfileOut(BaseModel):
    id: int
    user_id: int
    date_of_birth: str | None = None
    profile_photo_url: str | None = None
    address_line_1: str | None = None
    city: str | None = None
    country: str
    preferred_language: str
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# Fix forward reference
Token.model_rebuild()
