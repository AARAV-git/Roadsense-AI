// Copy this file to src/phone_gps_config.h and fill in your own values.
// Do NOT commit phone_gps_config.h (it holds your Wi-Fi password and API key).
#pragma once

#define PHONE_WIFI_SSID ""                  // 2.4 GHz hotspot
#define PHONE_WIFI_PASSWORD ""
#define PHONE_GPS_HOST ""                   // phone IP running the GPS relay ("" to disable)
#define PHONE_GPS_PORT 5000

// --- backend connection (new) ---
#define BACKEND_URL "http://192.168.1.50:8000/api/sensors"   // laptop IP: run ipconfig
#define BACKEND_API_KEY "paste-API_KEY-from-backend/.env"
#define NODE_ID "esp32_01"
