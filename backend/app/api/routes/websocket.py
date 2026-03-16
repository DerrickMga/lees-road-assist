"""
WebSocket endpoint for real-time tracking updates.
"""

import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.tracking import LiveTrackingSession
from app.models.provider import ProviderLocation

router = APIRouter()
logger = logging.getLogger("websocket")

# In-memory connection manager (single-process; use Redis pub/sub for multi-process)
_connections: dict[int, list[WebSocket]] = {}


class ConnectionManager:
    def __init__(self):
        self.active: dict[int, list[WebSocket]] = {}

    async def connect(self, request_id: int, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(request_id, []).append(ws)

    def disconnect(self, request_id: int, ws: WebSocket):
        conns = self.active.get(request_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns and request_id in self.active:
            del self.active[request_id]

    async def broadcast(self, request_id: int, data: dict):
        for ws in self.active.get(request_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass


manager = ConnectionManager()


@router.websocket("/tracking/{request_id}")
async def tracking_ws(request_id: int, websocket: WebSocket):
    """
    Customer or admin connects to receive real-time provider location for a request.
    Provider sends location updates which get broadcast to all listeners.
    """
    await manager.connect(request_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            # If provider is sending location update, broadcast to listeners
            if data.get("type") == "location_update":
                await manager.broadcast(request_id, {
                    "type": "location_update",
                    "latitude": data.get("latitude"),
                    "longitude": data.get("longitude"),
                    "heading": data.get("heading"),
                    "speed": data.get("speed"),
                    "timestamp": data.get("timestamp"),
                })
            elif data.get("type") == "status_update":
                await manager.broadcast(request_id, {
                    "type": "status_update",
                    "status": data.get("status"),
                    "message": data.get("message"),
                })
    except WebSocketDisconnect:
        manager.disconnect(request_id, websocket)
