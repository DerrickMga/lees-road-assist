# Lee's Rescue — On-Demand Roadside Assistance Platform

Lee's Rescue is a full-stack on-demand roadside assistance platform connecting stranded motorists with verified service providers in real time. Think "Uber for roadside help."

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend API** | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), PostgreSQL, Redis, Celery |
| **Mobile App** | Flutter (Dart) — iOS & Android |
| **Web Dashboard** | Next.js 15 (TypeScript), Tailwind CSS, App Router |
| **Infrastructure** | Docker Compose, Alembic migrations |

## Project Structure

```
LEE'S_ROAD_ASSIST/
├── backend/            # FastAPI REST API + WebSocket server
│   ├── app/
│   │   ├── api/        # Route handlers (auth, users, vehicles, requests, providers, payments, ratings, whatsapp, websocket)
│   │   ├── core/       # Config, security (JWT/bcrypt), database engine
│   │   ├── models/     # SQLAlchemy ORM models
│   │   ├── schemas/    # Pydantic v2 request/response schemas
│   │   ├── services/   # Business logic (dispatch, pricing)
│   │   ├── main.py     # FastAPI application factory
│   │   └── worker.py   # Celery task definitions
│   ├── alembic/        # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── mobile/             # Flutter mobile app
│   ├── lib/
│   │   ├── config/     # App config, theme
│   │   ├── models/     # Dart data models
│   │   ├── providers/  # ChangeNotifier state management
│   │   ├── screens/    # UI screens (auth, home, request, tracking, profile)
│   │   ├── services/   # API client, location service
│   │   └── main.dart   # App entry point
│   └── pubspec.yaml
├── web/                # Next.js admin dashboard
│   ├── src/
│   │   ├── app/        # App Router pages (dashboard, requests, users, providers, payments, map, analytics, settings)
│   │   ├── components/ # Reusable UI components (sidebar, stat cards, tables)
│   │   ├── lib/        # API client, constants
│   │   └── types/      # TypeScript interfaces
│   └── Dockerfile
├── docker-compose.yml  # Full-stack orchestration
└── README.md
```

## Services Offered

- **Jumpstart** — Battery boost
- **Towing** — Vehicle towing to destination
- **Puncture Repair** — Flat tire change/repair
- **Fuel Delivery** — Emergency fuel drop-off
- **Lockout** — Vehicle lock-out assistance
- **Mechanical** — On-site minor mechanical repair
- **Recovery** — Off-road/accident vehicle recovery
- **Accident** — Accident scene assistance
- **Other** — Custom roadside requests

## Getting Started

### Prerequisites

- Docker & Docker Compose
- (For local dev) Python 3.12+, Node.js 20+, Flutter SDK 3.11+

### Run with Docker Compose

```bash
# 1. Copy environment files
cp backend/.env.example backend/.env
cp web/.env.local.example web/.env.local

# 2. Edit backend/.env with your credentials (DB, Stripe, WhatsApp, etc.)

# 3. Start all services
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Web Dashboard | http://localhost:3000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Local Development

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:create_app --factory --reload --port 8000
```

#### Mobile App

```bash
cd mobile
flutter pub get
flutter run          # Launch on connected device/emulator
```

#### Web Dashboard

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET_KEY` | Secret for JWT token signing |
| `STRIPE_SECRET_KEY` | Stripe API key for payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `WHATSAPP_TOKEN` | WhatsApp Cloud API token |
| `GOOGLE_MAPS_API_KEY` | Google Maps Platform key |

## API Overview

All API routes are prefixed with `/api/v1`. Key endpoints:

- `POST /auth/register` — User registration
- `POST /auth/login` — JWT authentication
- `GET /users/me` — Current user profile
- `POST /vehicles/` — Add vehicle
- `POST /service-requests/` — Create assistance request (triggers dispatch)
- `PATCH /providers/{id}/location` — Update provider GPS
- `POST /providers/{id}/accept/{request_id}` — Accept a job
- `WS /ws/tracking/{request_id}` — Real-time location tracking
- `POST /webhooks/stripe` — Stripe payment webhook
- `GET /webhooks/whatsapp` — WhatsApp webhook verification

Full interactive docs available at `/docs` (Swagger UI) when the backend is running.

## Architecture Highlights

- **Smart Dispatch** — Nearest available provider matched by service capability, towing capacity, and rating
- **Real-Time Tracking** — WebSocket-based live location between customer and provider
- **Dynamic Pricing** — Base fee per service type + distance-based towing charges + callout fee
- **Subscription Plans** — Basic, Standard, and Premium tiers with free services and discounts
- **Multi-Channel** — WhatsApp Cloud API webhook for conversational requests

## License

Proprietary — All rights reserved.
