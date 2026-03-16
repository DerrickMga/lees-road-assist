from datetime import datetime
from pydantic import BaseModel


class VehicleCreate(BaseModel):
    make: str
    model: str
    year: str | None = None
    registration_number: str
    colour: str | None = None
    fuel_type: str | None = None
    transmission_type: str | None = None
    vehicle_category: str = "sedan"
    vin: str | None = None
    notes: str | None = None
    is_default: bool = False


class VehicleUpdate(BaseModel):
    make: str | None = None
    model: str | None = None
    year: str | None = None
    registration_number: str | None = None
    colour: str | None = None
    fuel_type: str | None = None
    transmission_type: str | None = None
    vehicle_category: str | None = None
    notes: str | None = None
    is_default: bool | None = None


class VehicleOut(BaseModel):
    id: int
    user_id: int
    make: str
    model: str
    year: str | None = None
    registration_number: str
    colour: str | None = None
    fuel_type: str | None = None
    transmission_type: str | None = None
    vehicle_category: str
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}
