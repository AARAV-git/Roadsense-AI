#include <Arduino.h>
#include <MPU6500_WE.h>
#include <TinyGPSPlus.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WebServer.h>
#include <HTTPClient.h>

#include "phone_gps_config.h"

constexpr int LED_PIN        = 2;    // built-in blue LED on most ESP32 dev boards
constexpr int GPS_RX_PIN = 16;
constexpr int GPS_TX_PIN = 17;
constexpr int I2C_SDA_PIN = 21;
constexpr int I2C_SCL_PIN = 22;
constexpr uint32_t GPS_BAUD = 9600;
constexpr uint32_t REPORT_INTERVAL_MS = 1000;
constexpr uint32_t NEO_FIX_MAX_AGE_MS = 3000;
constexpr uint32_t PHONE_FIX_MAX_AGE_MS = 5000;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
constexpr uint32_t PHONE_RETRY_INTERVAL_MS = 3000;

// ---- backend link / braking detection settings (new) ----
constexpr uint32_t IMU_SAMPLE_INTERVAL_MS = 20;   // 50 Hz
constexpr float BRAKE_THRESHOLD_G = 0.25f;
constexpr float TURN_THRESHOLD_G = 0.25f;
constexpr int FORWARD_AXIS = 0;       // 0=X 1=Y 2=Z : the axis pointing forward in the vehicle
constexpr float FORWARD_SIGN = 1.0f;  // set -1.0f if braking shows up as positive
constexpr int LATERAL_AXIS = 1;
constexpr uint32_t POST_TIMEOUT_MS = 3000;

struct OutPacket {
  char body[768];
};
QueueHandle_t postQueue;
float baseG[3] = {0, 0, 0};
float windowMaxDecelG = 0;
float windowMaxLateralG = 0;
uint32_t lastImuSampleMs = 0;
uint32_t packetSeq = 0;
bool backendConnected = false;   // true after a successful POST
uint32_t lastLedToggleMs = 0;
bool ledState = false;

TinyGPSPlus gps;
TinyGPSPlus phoneGps;
WiFiClient phoneGpsClient;
IPAddress phoneGpsAddress;
MPU6500_WE* imu = nullptr;
bool imuReady = false;
uint8_t imuAddress = 0;
uint8_t imuWhoAmI = 0;
bool imuWhoAmIValid = false;
bool wifiConfigured = false;
bool phoneFallbackConfigured = false;
bool webServerStarted = false;
uint32_t lastWifiAttemptMs = 0;
uint32_t lastPhoneAttemptMs = 0;
uint32_t lastReportMs = 0;
String latestTelemetry = "{}";
WebServer webServer(80);

const char LIVE_PAGE[] PROGMEM = R"rawliteral(
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f4f6f5">
<title>RoadSense Live Sensors</title>
<style>
:root{color-scheme:light;--ink:#15231f;--muted:#60716b;--line:#dce4df;--paper:#f4f6f5;--white:#fff;--green:#087f5b;--amber:#a65b00;--red:#b42318}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
header{background:#17372d;color:#f2f7f4;padding:18px max(20px,calc((100vw - 760px)/2));display:flex;justify-content:space-between;align-items:center;gap:12px}
.brand{font-size:14px;font-weight:700}.connection{font-size:12px;color:#c1d8cd}main{max-width:760px;margin:auto;padding:24px 16px 48px}
h1{font-size:24px;margin:0 0 5px} .sub{color:var(--muted);margin:0 0 22px;font-size:14px}
.section{margin:20px 0 8px;font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase}
.panel{background:var(--white);border:1px solid var(--line);border-radius:8px;padding:18px;margin-bottom:12px}
.row{display:flex;justify-content:space-between;align-items:center;gap:12px}.status{font-size:18px;font-weight:700}.badge{font-size:12px;font-weight:700;padding:4px 9px;border-radius:99px;background:#edf1ee;color:var(--muted)}.ok{color:var(--green)}.warn{color:var(--amber)}.bad{color:var(--red)}
.gps-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.source-title{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.metric{background:#f4f6f5;border-radius:6px;padding:12px;min-width:0}.label{font-size:12px;color:var(--muted)}.value{font-size:19px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.diagnostics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px;font-size:12px;color:var(--muted)}.diagnostics b{display:block;font-size:15px;color:var(--ink);font-variant-numeric:tabular-nums}
.axes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.axis{border-top:1px solid var(--line);padding-top:9px}.axis b{display:block;font-size:12px;color:var(--muted)}.axis span{font-size:18px;font-variant-numeric:tabular-nums}
footer{color:var(--muted);font-size:12px;padding:4px 2px}@media(max-width:620px){.gps-grid{grid-template-columns:1fr}}@media(max-width:420px){main{padding:18px 12px 32px}.panel{padding:14px}.value{font-size:16px}}
</style>
</head>
<body>
<header><div class="brand">ROADSENSE / SENSOR CHECK</div><div class="connection" id="connection">Connecting</div></header>
<main>
<h1>Live sensor status</h1><p class="sub">Updates every second from the ESP32.</p>
<div class="section">GPS receivers</div>
<div class="gps-grid">
 <section class="panel">
  <div class="row"><div><div class="source-title">Neo-6M</div><div class="status warn" id="neoStatus">Waiting for data</div></div><span class="badge" id="neoSatellites">Satellites --</span></div>
  <div class="grid"><div class="metric"><div class="label">Latitude</div><div class="value" id="neoLatitude">--</div></div><div class="metric"><div class="label">Longitude</div><div class="value" id="neoLongitude">--</div></div><div class="metric"><div class="label">Speed</div><div class="value" id="neoSpeed">--</div></div></div>
  <div class="diagnostics"><div>NMEA chars<b id="neoNmea">0</b></div><div>Valid sentences<b id="neoPassed">0</b></div><div>Bad checksums<b id="neoFailed">0</b></div></div>
 </section>
 <section class="panel">
  <div class="row"><div><div class="source-title">Phone GPS</div><div class="status warn" id="phoneStatus">Waiting for relay</div></div><span class="badge" id="phoneRelay">Relay disconnected</span></div>
  <div class="grid"><div class="metric"><div class="label">Latitude</div><div class="value" id="phoneLatitude">--</div></div><div class="metric"><div class="label">Longitude</div><div class="value" id="phoneLongitude">--</div></div><div class="metric"><div class="label">Speed</div><div class="value" id="phoneSpeed">--</div></div></div>
  <div class="row" style="margin-top:14px;font-size:14px"><span>Satellites <b id="phoneSatellites">--</b></span></div>
  <div class="diagnostics"><div>NMEA chars<b id="phoneNmea">0</b></div><div>Valid sentences<b id="phonePassed">0</b></div><div>Bad checksums<b id="phoneFailed">0</b></div></div>
 </section>
</div>
<div class="section">MPU6050 / motion sensor</div>
<section class="panel">
 <div class="row"><div class="status" id="imuStatus">Waiting for data</div><span class="badge" id="imuAddress">--</span></div>
 <div class="label" style="margin-top:14px">Acceleration (g)</div><div class="axes"><div class="axis"><b>X</b><span id="ax">--</span></div><div class="axis"><b>Y</b><span id="ay">--</span></div><div class="axis"><b>Z</b><span id="az">--</span></div></div>
 <div class="label" style="margin-top:14px">Rotation (deg/s)</div><div class="axes"><div class="axis"><b>X</b><span id="gx">--</span></div><div class="axis"><b>Y</b><span id="gy">--</span></div><div class="axis"><b>Z</b><span id="gz">--</span></div></div>
 <div class="row" style="margin-top:14px;font-size:14px"><span>Chip temperature</span><b id="temperature">--</b></div>
</section>
<footer id="updated">Waiting for first update</footer>
</main>
<script>
const byId=id=>document.getElementById(id);const set=(id,value)=>byId(id).textContent=value??"--";const status=(id,text,kind)=>{const e=byId(id);e.textContent=text;e.className="status "+kind};
function renderGps(prefix,gps,relayConnected){const fix=gps.status==='fix';const waiting=gps.status==='waiting_for_fix';status(prefix+'Status',fix?'Location fix':waiting?'Waiting for fix':'No GPS data',fix?'ok':waiting?'warn':'bad');set(prefix+'Latitude',fix?Number(gps.latitude).toFixed(6):'--');set(prefix+'Longitude',fix?Number(gps.longitude).toFixed(6):'--');set(prefix+'Speed',fix&&gps.speed_kmh!=null?Number(gps.speed_kmh).toFixed(1)+' km/h':'--');set(prefix+'Satellites',gps.satellites??'--');set(prefix+'Nmea',gps.nmea_chars??0);set(prefix+'Passed',gps.passed_checksums??0);set(prefix+'Failed',gps.failed_checksums??0);if(prefix==='phone'){set('phoneRelay',relayConnected?'Relay connected':'Relay disconnected');}}
async function refresh(){try{const response=await fetch('/api/status',{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();const sources=data.gps_sources||{};const imu=data.imu||{};set('connection','ESP32 online');renderGps('neo',sources.neo6m||{},false);renderGps('phone',sources.phone||{},sources.phone_tcp_connected===true);
if(imu.status==='ok'){status('imuStatus','Reading','ok');set('imuAddress',imu.address);for(const axis of ['x','y','z']){set('a'+axis,Number(imu.accel_g[axis]).toFixed(3));set('g'+axis,Number(imu.gyro_dps[axis]).toFixed(3))}set('temperature',Number(imu.temperature_c).toFixed(1)+' °C')}else{status('imuStatus','Unavailable','bad');set('imuAddress',imu.address||imu.status);for(const id of ['ax','ay','az','gx','gy','gz','temperature'])set(id,'--')}
set('updated','Updated '+new Date().toLocaleTimeString())}catch(error){set('connection','ESP32 not reachable');status('gpsStatus','Dashboard connection lost','bad');set('updated',error.message)}}
refresh();setInterval(refresh,1000);
</script>
</body>
</html>
)rawliteral";

bool readWhoAmI(uint8_t address, uint8_t& value) {
  Wire.beginTransmission(address);
  Wire.write(0x75);
  if (Wire.endTransmission(false) != 0 || Wire.requestFrom(address, static_cast<uint8_t>(1)) != 1) {
    return false;
  }
  value = Wire.read();
  return true;
}

void servicePhoneGps(uint32_t now) {
  if (!wifiConfigured) {
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    phoneGpsClient.stop();
    if (now - lastWifiAttemptMs >= WIFI_RETRY_INTERVAL_MS) {
      lastWifiAttemptMs = now;
      WiFi.disconnect();
      WiFi.begin(PHONE_WIFI_SSID, PHONE_WIFI_PASSWORD);
    }
    return;
  }

  if (!webServerStarted) {
    webServer.on("/", []() { webServer.send_P(200, "text/html", LIVE_PAGE); });
    webServer.on("/api/status", []() {
      webServer.send(200, "application/json", latestTelemetry);
    });
    webServer.begin();
    webServerStarted = true;
    Serial.printf("{\"status\":\"dashboard_ready\",\"ip\":\"%s\",\"port\":80}\n",
                  WiFi.localIP().toString().c_str());
  }
  webServer.handleClient();

  if (!phoneFallbackConfigured) {
    return;
  }

  if (!phoneGpsClient.connected() &&
      (lastPhoneAttemptMs == 0 || now - lastPhoneAttemptMs >= PHONE_RETRY_INTERVAL_MS)) {
    lastPhoneAttemptMs = now;
    phoneGpsClient.stop();
    phoneGpsClient.connect(phoneGpsAddress, PHONE_GPS_PORT, 100);   // was 500: shorter so GPS bytes aren't lost
  }

  while (phoneGpsClient.connected() && phoneGpsClient.available() > 0) {
    phoneGps.encode(phoneGpsClient.read());
  }
}

String buildGpsSourceTelemetryJson(TinyGPSPlus& source, uint32_t maxFixAge) {
  const bool hasFix = source.location.isValid() && source.location.age() <= maxFixAge;
  String output = "{\"status\":\"";
  output += hasFix ? "fix" : source.charsProcessed() > 0 ? "waiting_for_fix" : "no_data";
  output += "\",\"nmea_chars\":";
  output += String(source.charsProcessed());
  output += ",\"passed_checksums\":";
  output += String(source.passedChecksum());
  output += ",\"failed_checksums\":";
  output += String(source.failedChecksum());
  output += ",\"satellites\":";
  if (source.satellites.isValid()) {
    output += String(source.satellites.value());
  } else {
    output += "null";
  }

  if (hasFix) {
    output += ",\"latitude\":";
    output += String(source.location.lat(), 6);
    output += ",\"longitude\":";
    output += String(source.location.lng(), 6);
    output += ",\"speed_kmh\":";
    if (source.speed.isValid()) {
      output += String(source.speed.kmph(), 2);
    } else {
      output += "null";
    }
  }
  output += "}";
  return output;
}

String buildGpsTelemetryJson() {
  TinyGPSPlus* selectedGps = nullptr;
  const char* source = "none";

  const bool neoHasFix = gps.location.isValid() && gps.location.age() <= NEO_FIX_MAX_AGE_MS;
  const bool phoneHasFix = phoneFallbackConfigured && phoneGps.location.isValid() &&
                           phoneGps.location.age() <= PHONE_FIX_MAX_AGE_MS;

  if (neoHasFix) {
    selectedGps = &gps;
    source = "neo6m";
  } else if (phoneHasFix) {
    selectedGps = &phoneGps;
    source = "phone";
  } else if (gps.charsProcessed() > 0) {
    selectedGps = &gps;
    source = "neo6m";
  } else if (phoneGps.charsProcessed() > 0) {
    selectedGps = &phoneGps;
    source = "phone";
  }

  String output = "{\"source\":\"";
  output += source;
  output += "\",\"phone_tcp_connected\":";
  output += phoneGpsClient.connected() ? "true" : "false";

  if (selectedGps == nullptr) {
    output += ",\"status\":\"no_data\"}";
    return output;
  }

  const uint32_t maxFixAge = selectedGps == &gps ? NEO_FIX_MAX_AGE_MS : PHONE_FIX_MAX_AGE_MS;
  const bool selectedHasFix = selectedGps->location.isValid() &&
                              selectedGps->location.age() <= maxFixAge;
  if (!selectedHasFix) {
    output += ",\"status\":\"waiting_for_fix\",\"nmea_chars\":";
    output += String(selectedGps->charsProcessed());
    output += ",\"satellites\":";
    if (selectedGps->satellites.isValid()) {
      output += String(selectedGps->satellites.value());
    } else {
      output += "null";
    }
    output += "}";
    return output;
  }

  output += ",\"status\":\"fix\",\"latitude\":";
  output += String(selectedGps->location.lat(), 6);
  output += ",\"longitude\":";
  output += String(selectedGps->location.lng(), 6);
  output += ",\"speed_kmh\":";
  if (selectedGps->speed.isValid()) {
    output += String(selectedGps->speed.kmph(), 2);
  } else {
    output += "null";
  }
  output += ",\"satellites\":";
  if (selectedGps->satellites.isValid()) {
    output += String(selectedGps->satellites.value());
  } else {
    output += "null";
  }
  output += "}";
  return output;
}

String buildTelemetryJson() {
  String output = "{\"gps\":";
  output += buildGpsTelemetryJson();
  output += ",\"gps_sources\":{\"neo6m\":";
  output += buildGpsSourceTelemetryJson(gps, NEO_FIX_MAX_AGE_MS);
  output += ",\"phone\":";
  output += buildGpsSourceTelemetryJson(phoneGps, PHONE_FIX_MAX_AGE_MS);
  output += ",\"phone_tcp_connected\":";
  output += phoneGpsClient.connected() ? "true" : "false";
  output += "}";
  output += ",\"imu\":{";

  if (!imuReady) {
    if (imuAddress == 0) {
      output += "\"status\":\"no_i2c_ack\",\"address\":null";
    } else {
      output += "\"status\":\"init_failed\",\"address\":\"0x";
      if (imuAddress < 16) output += "0";
      output += String(imuAddress, HEX);
      output += "\",\"who_am_i\":";
      if (imuWhoAmIValid) {
        output += "\"0x";
        if (imuWhoAmI < 16) output += "0";
        output += String(imuWhoAmI, HEX);
        output += "\"";
      } else {
        output += "null";
      }
    }
  } else {
    const xyzFloat acceleration = imu->getGValues();
    const xyzFloat rotation = imu->getGyrValues();
    output += "\"status\":\"ok\",\"address\":\"0x";
    if (imuAddress < 16) output += "0";
    output += String(imuAddress, HEX);
    output += "\",\"accel_g\":{";
    output += "\"x\":" + String(acceleration.x, 3);
    output += ",\"y\":" + String(acceleration.y, 3);
    output += ",\"z\":" + String(acceleration.z, 3);
    output += "},\"gyro_dps\":{";
    output += "\"x\":" + String(rotation.x, 3);
    output += ",\"y\":" + String(rotation.y, 3);
    output += ",\"z\":" + String(rotation.z, 3);
    output += "},\"temperature_c\":" + String(imu->getTemperature(), 2);
  }

  output += "},\"dashboard_url\":\"";
  if (webServerStarted && WiFi.status() == WL_CONNECTED) {
    output += "http://";
    output += WiFi.localIP().toString();
    output += "/";
  }
  output += "\"}";
  return output;
}

// ------------------------------------------------------------------
// Backend link (new): 50 Hz IMU window -> event flag -> HTTP POST once a second
// ------------------------------------------------------------------
float axisValue(const xyzFloat& v, int axis) {
  return axis == 0 ? v.x : axis == 1 ? v.y : v.z;
}

void calibrateGravity() {            // keep the board still for ~1 s after boot
  if (!imuReady) return;
  float sum[3] = {0, 0, 0};
  const int N = 50;
  for (int i = 0; i < N; i++) {
    const xyzFloat a = imu->getGValues();
    sum[0] += a.x;
    sum[1] += a.y;
    sum[2] += a.z;
    delay(20);
  }
  for (int i = 0; i < 3; i++) baseG[i] = sum[i] / N;
}

void sampleImu(uint32_t now) {       // called every loop, samples at 50 Hz
  if (!imuReady || now - lastImuSampleMs < IMU_SAMPLE_INTERVAL_MS) return;
  lastImuSampleMs = now;
  const xyzFloat a = imu->getGValues();
  const float fwd = (axisValue(a, FORWARD_AXIS) - baseG[FORWARD_AXIS]) * FORWARD_SIGN;
  const float lat = fabsf(axisValue(a, LATERAL_AXIS) - baseG[LATERAL_AXIS]);
  const float decel = fwd < 0 ? -fwd : 0;
  if (decel > windowMaxDecelG) windowMaxDecelG = decel;
  if (lat > windowMaxLateralG) windowMaxLateralG = lat;
}

const char* eventName() {
  const bool brake = windowMaxDecelG >= BRAKE_THRESHOLD_G;
  const bool turn = windowMaxLateralG >= TURN_THRESHOLD_G;
  if (brake && (!turn || windowMaxDecelG >= windowMaxLateralG)) return "harsh_brake";
  if (turn) return "sharp_turn";
  return "none";
}

String buildBackendPacket() {
  String out = "{\"node_id\":\"" NODE_ID "\",\"seq\":";
  out += String(packetSeq++);
  out += ",\"uptime_ms\":";
  out += String(millis());
  out += ",\"gps\":";
  out += buildGpsTelemetryJson();
  out += ",\"imu\":{\"peak_decel_g\":";
  out += String(windowMaxDecelG, 3);
  out += ",\"peak_lateral_g\":";
  out += String(windowMaxLateralG, 3);
  out += ",\"event\":\"";
  out += eventName();
  out += "\"}}";
  windowMaxDecelG = 0;
  windowMaxLateralG = 0;
  return out;
}

void postToBackend(const char* body) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("{\"post_error\":\"wifi_not_connected\"}");
    return;
  }
  HTTPClient http;
  http.setConnectTimeout(POST_TIMEOUT_MS);
  http.setTimeout(POST_TIMEOUT_MS);
  if (!http.begin(BACKEND_URL)) {
    Serial.println("{\"post_error\":\"http_begin_failed\",\"url\":\"" BACKEND_URL "\"}");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", BACKEND_API_KEY);
  int code = http.POST(body);
  if (code == 200) {
    backendConnected = true;   // light up LED fast-blink
  } else if (code < 0) {
    backendConnected = false;
    Serial.printf("{\"post_error\":\"http_error\",\"code\":%d,\"msg\":\"%s\"}\n",
                  code, http.errorToString(code).c_str());
  } else {
    Serial.printf("{\"post_warn\":\"unexpected_status\",\"code\":%d}\n", code);
  }
  http.end();
}

void postTask(void*) {               // runs on core 0 so a slow POST never blocks IMU sampling
  OutPacket p;
  for (;;) {
    if (xQueueReceive(postQueue, &p, portMAX_DELAY) == pdTRUE) postToBackend(p.body);
  }
}

void enqueuePacket() {
  const String packet = buildBackendPacket();
  if (packet.length() >= sizeof(OutPacket::body)) return;
  OutPacket p;
  packet.toCharArray(p.body, sizeof(p.body));
  xQueueSend(postQueue, &p, 0);      // if the queue is full the packet is dropped; seq shows the gap
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  delay(500);

  Serial2.setRxBufferSize(1024);     // new: prevents NMEA loss while Wi-Fi work blocks the loop
  Serial2.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  wifiConfigured = PHONE_WIFI_SSID[0] != '\0';
  phoneFallbackConfigured = wifiConfigured && PHONE_GPS_HOST[0] != '\0' &&
                            phoneGpsAddress.fromString(PHONE_GPS_HOST);
  if (wifiConfigured) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(PHONE_WIFI_SSID, PHONE_WIFI_PASSWORD);
    lastWifiAttemptMs = millis();
  }

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);

  Wire.beginTransmission(0x68);
  const bool ack68 = Wire.endTransmission() == 0;
  Wire.beginTransmission(0x69);
  const bool ack69 = Wire.endTransmission() == 0;
  if (ack68) {
    imuAddress = 0x68;
  } else if (ack69) {
    imuAddress = 0x69;
  }

  if (imuAddress != 0) {
    imuWhoAmIValid = readWhoAmI(imuAddress, imuWhoAmI);
    imu = new MPU6500_WE(imuAddress);
    const bool libraryInitSucceeded = imu->init();
    const bool knownImuId = imuWhoAmIValid && (imuWhoAmI == 0x68 || imuWhoAmI == 0x70);
    imuReady = libraryInitSucceeded || knownImuId;
  }

  if (imuReady) {
    imu->setAccRange(MPU6500_ACC_RANGE_2G);
    imu->setGyrRange(MPU6500_GYRO_RANGE_250);
  }

  calibrateGravity();                // new: keep the board still for ~1 s after power-up
  postQueue = xQueueCreate(4, sizeof(OutPacket));
  xTaskCreatePinnedToCore(postTask, "post", 8192, nullptr, 1, nullptr, 0);

  Serial.print("{\"status\":\"RoadSense ESP32 initialized\",\"gps_uart_rx\":");
  Serial.print(GPS_RX_PIN);
  Serial.print(",\"i2c_ack_0x68\":");
  Serial.print(ack68 ? "true" : "false");
  Serial.print(",\"i2c_ack_0x69\":");
  Serial.print(ack69 ? "true" : "false");
  Serial.print(",\"imu_address\":");
  if (imuAddress == 0) {
    Serial.print("null");
  } else {
    Serial.printf("\"0x%02X\"", imuAddress);
  }
  Serial.print(",\"imu_ready\":");
  Serial.print(imuReady ? "true" : "false");
  Serial.print(",\"phone_fallback_configured\":");
  Serial.print(phoneFallbackConfigured ? "true" : "false");
  Serial.print(",\"wifi_configured\":");
  Serial.print(wifiConfigured ? "true" : "false");
  Serial.println("}");
}

void loop() {
  while (Serial2.available() > 0) {
    gps.encode(Serial2.read());
  }

  const uint32_t now = millis();

  // ---- LED status indicator ----
  // Fast blink (200ms): backend connected and posting
  // Slow blink (1000ms): Wi-Fi connected but backend not responding
  // Off: no Wi-Fi
  uint32_t blinkInterval = 0;
  if (WiFi.status() == WL_CONNECTED) {
    blinkInterval = backendConnected ? 200 : 1000;
  }
  if (blinkInterval > 0 && now - lastLedToggleMs >= blinkInterval) {
    lastLedToggleMs = now;
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  } else if (blinkInterval == 0) {
    digitalWrite(LED_PIN, LOW);  // off = no Wi-Fi
    ledState = false;
  }

  sampleImu(now);
  servicePhoneGps(now);
  if (now - lastReportMs < REPORT_INTERVAL_MS) {
    return;
  }
  lastReportMs = now;

  latestTelemetry = buildTelemetryJson();
  Serial.println(latestTelemetry);
  enqueuePacket();
}
