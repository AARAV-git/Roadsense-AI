import json

import httpx

from ..config import settings

LABELS = {"lane_cut": "Lane cut", "sudden_slowdown": "Sudden slowdown ahead", "high_chaos": "Chaotic traffic"}


def template_explanation(alert_type: str, f: dict) -> str:
    label = LABELS.get(alert_type, alert_type)
    if f["reason"] == "confirmed":
        return f"{label} confirmed by camera and motion sensor, {f['level']} confidence."
    if f["reason"] == "camera_only_calm":
        return f"{label} seen by camera only; motion sensor shows no matching movement, {f['level']} confidence."
    return f"{label} seen by camera only; sensor data missing or delayed, {f['level']} confidence."


async def explain(alert_type: str, f: dict) -> str:
    fallback = template_explanation(alert_type, f)
    if not settings.groq_api_key:
        return fallback
    facts = {"alert": LABELS.get(alert_type, alert_type), "reason": f["reason"], "level": f["level"],
             "vision_conf": f["vision_conf"], "sensor_conf": f["sensor_conf"], "trust_weight": f["trust_weight"]}
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={"model": settings.groq_model, "max_tokens": 60, "temperature": 0.2,
                      "messages": [
                          {"role": "system", "content": "Explain a driver-assistance alert in one plain sentence "
                           "(max 25 words). State whether camera and motion sensor agreed and how confident the "
                           "system is. Use only the facts given."},
                          {"role": "user", "content": json.dumps(facts)}]})
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip() or fallback
    except Exception:
        return fallback   # the demo never breaks if the API is down
