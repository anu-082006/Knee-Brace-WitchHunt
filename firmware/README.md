# Arduino firmware (MPU6050 + HC-05)

## Where the sketch lives

Open this folder in **Arduino IDE**:

- `firmware/KneeRehabMonitoring/KneeRehabMonitoring.ino`

Arduino IDE expects the `.ino` filename to match the folder name (`KneeRehabMonitoring`).

## How this ties to the web app

- **Web Serial (OrthoConnect in the browser)** reads the USB serial stream from `Serial.print` / `Serial.println` on the board (same as the Arduino Serial Monitor).
- **Bluetooth (`SoftwareSerial`)** is used for commands and `KNEE_DATA:` JSON; the browser does not talk to HC-05 directly unless you add a separate bridge.

Your `printAngleData()` line looks like:

`Knee Angle: …° | Roll: … | Pitch: … | Yaw: …`

The React hook `useArduinoConnection` is written to accept that format (and the older `Angle:` style).

## Libraries

Install via Arduino Library Manager if needed:

- **ArduinoJson** (v6 API: `StaticJsonDocument`, `createNestedObject` — use a version that matches this sketch, e.g. v6.x)

Also ensure **Wire** is available (built-in on most AVR boards).

## PlatformIO (no Arduino IDE)

From this repo:

```bash
cd firmware/KneeRehabMonitoring
pio run                    # build
pio run -t upload          # upload (pick the correct serial port when prompted)
pio device monitor         # serial monitor @ 9600 baud
```

Edit `platformio.ini` if your board is not an **Arduino Uno** (change `board = ...` and, if needed, `platform = ...`). Install cores with `pio platform install atmelavr` the first time if prompted.
