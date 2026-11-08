import time
from collections import deque, defaultdict


class Hub:
    """In-memory live state: recent sensor packets, WebSocket clients, latest video frame."""

    def __init__(self):
        self.sensor_packets: deque[dict] = deque(maxlen=20)   # newest last
        self.subscribers = defaultdict(set)                    # session_id -> websockets
        self.last_tick: dict[int, dict] = {}
        self.jpeg: dict[int, bytes] = {}                       # latest annotated frame per session

    def push_sensor(self, data: dict):
        self.sensor_packets.append({**data, "recv_mono": time.monotonic()})

    def recent_packets(self) -> list[dict]:
        return list(self.sensor_packets)

    async def subscribe(self, sid: int, ws):
        await ws.accept()
        self.subscribers[sid].add(ws)
        if sid in self.last_tick:
            await ws.send_json(self.last_tick[sid])

    def unsubscribe(self, sid: int, ws):
        self.subscribers[sid].discard(ws)

    async def broadcast(self, sid: int, msg: dict):
        if msg.get("type") == "tick":
            self.last_tick[sid] = msg
        dead = []
        for ws in list(self.subscribers[sid]):
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.subscribers[sid].discard(ws)


hub = Hub()
