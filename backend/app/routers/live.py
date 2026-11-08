import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from ..services import pipeline
from ..services.hub import hub

router = APIRouter(tags=["live"])


@router.websocket("/ws/live/{sid}")
async def live_ws(ws: WebSocket, sid: int):
    await hub.subscribe(sid, ws)
    try:
        while True:
            await ws.receive_text()      # keeps the connection open; we only push
    except WebSocketDisconnect:
        pass
    finally:
        hub.unsubscribe(sid, ws)


async def _mjpeg(sid: int):
    last_id = None
    while pipeline.is_active(sid):
        jpg = hub.jpeg.get(sid)
        if jpg and id(jpg) != last_id:
            last_id = id(jpg)
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
        await asyncio.sleep(0.02)


@router.get("/api/stream/{sid}")
async def stream(sid: int):
    return StreamingResponse(_mjpeg(sid), media_type="multipart/x-mixed-replace; boundary=frame")
