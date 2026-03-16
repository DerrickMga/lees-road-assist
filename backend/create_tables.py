"""Create all database tables using SQLAlchemy metadata."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("APP_ENV", "production")

from app.core.database import engine, Base
from app.models import *  # noqa: F401,F403 - import all models to register them

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("ALL TABLES CREATED SUCCESSFULLY")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_tables())
