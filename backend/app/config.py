from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite+aiosqlite:///./data/roadsense.db"
    api_key: str = "change-me"
    cors_origins: str = "http://localhost:3000"
    model_path: str = "weights/yolov8n.pt,weights/auto_rickshaw_best.pt,weights/rider_best.pt"
    detect_conf: float = 0.35
    detect_imgsz: int = 640
    process_every_n: int = 1            # run YOLO on every frame on RTX 3070
    sensor_fresh_seconds: float = 3.0   # sensor data older than this counts as stale
    match_window_seconds: float = 2.0   # how far back to look for a matching IMU spike
    event_threshold: float = 0.55       # vision strength needed to raise an event
    alert_cooldown_seconds: float = 4.0
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    upload_dir: str = "data/uploads"
    phone_camera_url: str = "http://192.168.31.157:8080/video"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
