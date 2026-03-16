#!/usr/bin/env python3
"""
create_db.py — One-shot database setup for Lee's Express Courier.

Creates the PostgreSQL database and all tables using SQLAlchemy metadata.
Run this once before starting the server for the first time.

Usage (from backend/ directory):
    python scripts/create_db.py

Requirements:
    - PostgreSQL running on localhost:5432
    - psycopg2-binary installed (for synchronous creation)
    - .env configured (or environment variables set)

To open in DBeaver:  New Connection → PostgreSQL → Host: localhost  Port: 5432
                     Database: lees_road_assist  User: postgres
"""

import asyncio
import sys
import os

# Allow imports from app/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def create_database_if_not_exists(
    host: str = "localhost",
    port: int = 5432,
    user: str = "postgres",
    password: str = "postgres",
    dbname: str = "lees_road_assist",
):
    """Connect to the default postgres DB and create our DB if it doesn't exist."""
    conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname="postgres")
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
    exists = cur.fetchone()

    if not exists:
        cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(dbname)))
        print(f"✅  Database '{dbname}' created.")
    else:
        print(f"ℹ️   Database '{dbname}' already exists — skipping creation.")

    cur.close()
    conn.close()


async def create_all_tables():
    """Use SQLAlchemy async engine to create all tables from model metadata."""
    from app.core.database import engine, Base
    import app.models  # noqa: F401 — registers all models with Base.metadata

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("✅  All tables created (or already exist).")


def main():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

    host    = os.getenv("DB_HOST", "localhost")
    port    = int(os.getenv("DB_PORT", "5432"))
    user    = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "postgres")
    dbname  = os.getenv("DB_NAME", "lees_road_assist")

    print("=" * 55)
    print("  Lee's Express Courier — Database Initialiser")
    print("=" * 55)
    print(f"  Host     : {host}:{port}")
    print(f"  Database : {dbname}")
    print(f"  User     : {user}")
    print()

    # Step 1: Create database
    create_database_if_not_exists(host=host, port=port, user=user, password=password, dbname=dbname)

    # Step 2: Create all tables
    asyncio.run(create_all_tables())

    print()
    print("🎉  Database ready. You can now start the server:")
    print("    uvicorn app.main:app --reload --port 8000")
    print()
    print("    DBeaver connection:")
    print(f"      Host: {host}  Port: {port}  DB: {dbname}  User: {user}")


if __name__ == "__main__":
    main()
