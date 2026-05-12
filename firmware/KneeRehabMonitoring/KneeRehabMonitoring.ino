#include <Wire.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h>
#include <math.h>

// MPU6050 Register Addresses
const int MPU = 0x68;
int16_t AcX, AcY, AcZ, Tmp, GyX, GyY, GyZ;

// HC-05 Bluetooth Module
SoftwareSerial bluetooth(2, 3); // RX, TX pins

// Angle calculation variables
float roll, pitch, yaw;
float dt, currentTime, previousTime;
float accAngleX, accAngleY, gyroAngleX, gyroAngleY, gyroAngleZ;
float elapsedTime;

// Complementary filter constant
float alpha = 0.96;

// Calibration offsets (will be calculated during setup)
float AccErrorX = 0, AccErrorY = 0, GyroErrorX = 0, GyroErrorY = 0, GyroErrorZ = 0;

// Timing variables
unsigned long previousMillis = 0;
const long interval = 100; // Send data every 100ms for smooth tracking

// Session tracking
String sessionId = "";
bool isRecording = false;
int exerciseType = 0; // 0: flexion, 1: extension, 2: lateral

void setup() {
  Serial.begin(9600);
  bluetooth.begin(9600);

  // Initialize I2C communication
  Wire.begin();
  Wire.beginTransmission(MPU);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0);    // Wake up the MPU-6050
  Wire.endTransmission(true);

  // Configure Accelerometer Sensitivity - Full Scale Range ±2g
  Wire.beginTransmission(MPU);
  Wire.write(0x1C); // ACCEL_CONFIG register
  Wire.write(0x00); // Set to ±2g
  Wire.endTransmission(true);

  // Configure Gyro Sensitivity - Full Scale Range ±250deg/s
  Wire.beginTransmission(MPU);
  Wire.write(0x1B); // GYRO_CONFIG register
  Wire.write(0x00); // Set to ±250deg/s
  Wire.endTransmission(true);

  delay(20);

  // Initialize angle variables
  roll = 0;
  pitch = 0;
  yaw = 0;
  gyroAngleX = 0;
  gyroAngleY = 0;
  gyroAngleZ = 0;

  // Calibrate the MPU6050
  calibrateMPU6050();

  previousTime = millis();

  Serial.println("Knee Rehabilitation Monitoring System Initialized");
  Serial.println("Commands: START_SESSION:<sessionId>, STOP_SESSION, SET_EXERCISE:<type>");
  bluetooth.println("SYSTEM_READY");
}

void loop() {
  // Check for Bluetooth commands
  if (bluetooth.available()) {
    String command = bluetooth.readString();
    command.trim();
    handleBluetoothCommand(command);
  }

  unsigned long currentMillis = millis();

  // Send data at specified interval
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // Read MPU6050 data
    readMPU6050();

    // Calculate angles
    calculateAngles();

    // Send data if recording
    if (isRecording) {
      sendKneeAngleData();
    }

    // Print to Serial for debugging
    printAngleData();
  }
}

void calibrateMPU6050() {
  Serial.println("Calibrating MPU6050... Keep sensor still!");
  bluetooth.println("CALIBRATING");

  // Reset calibration values
  AccErrorX = 0;
  AccErrorY = 0;
  GyroErrorX = 0;
  GyroErrorY = 0;
  GyroErrorZ = 0;

  // Calculate Accelerometer error
  for (int c = 0; c < 200; c++) {
    Wire.beginTransmission(MPU);
    Wire.write(0x3B);
    Wire.endTransmission(false);
    Wire.requestFrom(MPU, 6, true);

    int16_t tempAcX = (Wire.read() << 8 | Wire.read());
    int16_t tempAcY = (Wire.read() << 8 | Wire.read());
    int16_t tempAcZ = (Wire.read() << 8 | Wire.read());

    // Convert to g values
    float acX = tempAcX / 16384.0;
    float acY = tempAcY / 16384.0;
    float acZ = tempAcZ / 16384.0;

    // Check for valid denominator to avoid division by zero
    float denomX = sqrt(pow(acX, 2) + pow(acZ, 2));
    float denomY = sqrt(pow(acY, 2) + pow(acZ, 2));

    if (denomX > 0.01) { // Avoid division by very small numbers
      AccErrorX += (atan(acY / denomX) * 180 / PI);
    }
    if (denomY > 0.01) { // Avoid division by very small numbers
      AccErrorY += (atan(-1 * acX / denomY) * 180 / PI);
    }
    delay(3);
  }
  AccErrorX = AccErrorX / 200;
  AccErrorY = AccErrorY / 200;

  // Calculate Gyro error
  for (int c = 0; c < 200; c++) {
    Wire.beginTransmission(MPU);
    Wire.write(0x43);
    Wire.endTransmission(false);
    Wire.requestFrom(MPU, 6, true);

    int16_t tempGyX = Wire.read() << 8 | Wire.read();
    int16_t tempGyY = Wire.read() << 8 | Wire.read();
    int16_t tempGyZ = Wire.read() << 8 | Wire.read();

    GyroErrorX += (tempGyX / 131.0);
    GyroErrorY += (tempGyY / 131.0);
    GyroErrorZ += (tempGyZ / 131.0);
    delay(3);
  }
  GyroErrorX = GyroErrorX / 200;
  GyroErrorY = GyroErrorY / 200;
  GyroErrorZ = GyroErrorZ / 200;

  Serial.println("Calibration complete!");
  Serial.print("Accel Errors - X: ");
  Serial.print(AccErrorX);
  Serial.print(", Y: ");
  Serial.println(AccErrorY);
  Serial.print("Gyro Errors - X: ");
  Serial.print(GyroErrorX);
  Serial.print(", Y: ");
  Serial.print(GyroErrorY);
  Serial.print(", Z: ");
  Serial.println(GyroErrorZ);
  bluetooth.println("CALIBRATION_COMPLETE");
}

void readMPU6050() {
  // Read accelerometer data
  Wire.beginTransmission(MPU);
  Wire.write(0x3B); // Starting with register 0x3B (ACCEL_XOUT_H)
  Wire.endTransmission(false);
  Wire.requestFrom(MPU, 14, true);

  AcX = Wire.read() << 8 | Wire.read();
  AcY = Wire.read() << 8 | Wire.read();
  AcZ = Wire.read() << 8 | Wire.read();
  Tmp = Wire.read() << 8 | Wire.read();
  GyX = Wire.read() << 8 | Wire.read();
  GyY = Wire.read() << 8 | Wire.read();
  GyZ = Wire.read() << 8 | Wire.read();
}

void calculateAngles() {
  // Calculate time elapsed
  currentTime = millis();
  elapsedTime = (currentTime - previousTime) / 1000.0;

  // Prevent issues with very small or zero elapsed time
  if (elapsedTime <= 0) {
    elapsedTime = 0.001; // Minimum 1ms
  }

  previousTime = currentTime;

  // Convert accelerometer values to g
  float accX = AcX / 16384.0;
  float accY = AcY / 16384.0;
  float accZ = AcZ / 16384.0;

  // Calculate angles from accelerometer with safety checks
  float denomX = sqrt(pow(accX, 2) + pow(accZ, 2));
  float denomY = sqrt(pow(accY, 2) + pow(accZ, 2));

  if (denomX > 0.01) { // Safety check to avoid division by zero
    accAngleX = (atan(accY / denomX) * 180 / PI) - AccErrorX;
  } else {
    accAngleX = 0; // Default to 0 if calculation would be invalid
  }

  if (denomY > 0.01) { // Safety check to avoid division by zero
    accAngleY = (atan(-1 * accX / denomY) * 180 / PI) - AccErrorY;
  } else {
    accAngleY = 0; // Default to 0 if calculation would be invalid
  }

  // Convert gyroscope values to deg/s
  float gyroX = (GyX / 131.0) - GyroErrorX;
  float gyroY = (GyY / 131.0) - GyroErrorY;
  float gyroZ = (GyZ / 131.0) - GyroErrorZ;

  // Integrate gyroscope data
  gyroAngleX += gyroX * elapsedTime;
  gyroAngleY += gyroY * elapsedTime;
  gyroAngleZ += gyroZ * elapsedTime;

  // Apply complementary filter with NaN checks
  float newRoll = alpha * (roll + gyroX * elapsedTime) + (1 - alpha) * accAngleX;
  float newPitch = alpha * (pitch + gyroY * elapsedTime) + (1 - alpha) * accAngleY;

  // Check for NaN values before assignment
  if (!isnan(newRoll)) {
    roll = newRoll;
  }
  if (!isnan(newPitch)) {
    pitch = newPitch;
  }

  yaw = gyroAngleZ; // Yaw is only from gyroscope

  // Additional safety checks
  if (isnan(roll)) roll = 0;
  if (isnan(pitch)) pitch = 0;
  if (isnan(yaw)) yaw = 0;

  // Constrain angles to reasonable ranges
  roll = constrain(roll, -180, 180);
  pitch = constrain(pitch, -180, 180);
  yaw = constrain(yaw, -180, 180);
}

float getKneeAngle() {
  // Convert sensor angles to knee flexion angle
  // This calculation depends on sensor placement and calibration
  float kneeAngle = 0;

  // Safety checks for NaN values
  float safeRoll = isnan(roll) ? 0 : roll;
  float safePitch = isnan(pitch) ? 0 : pitch;

  switch (exerciseType) {
    case 0: // Knee flexion (bending)
      kneeAngle = 180 - abs(safePitch); // Adjust based on sensor orientation
      break;
    case 1: // Knee extension
      kneeAngle = abs(safePitch);
      break;
    case 2: // Lateral movement
      kneeAngle = abs(safeRoll);
      break;
    default:
      kneeAngle = abs(safePitch);
  }

  // Constrain angle to realistic knee range (0-160 degrees)
  kneeAngle = constrain(kneeAngle, 0, 160);

  // Final NaN check
  if (isnan(kneeAngle)) {
    kneeAngle = 0;
  }

  return kneeAngle;
}

void sendKneeAngleData() {
  // Create JSON object for Firebase
  StaticJsonDocument<400> doc;

  // Session information
  doc["sessionId"] = sessionId;
  doc["timestamp"] = millis();
  doc["exerciseType"] = exerciseType;

  // Raw sensor data with NaN checks
  JsonObject rawData = doc.createNestedObject("rawSensorData");
  float accelX = AcX / 16384.0;
  float accelY = AcY / 16384.0;
  float accelZ = AcZ / 16384.0;
  float gyroX = (GyX / 131.0) - GyroErrorX;
  float gyroY = (GyY / 131.0) - GyroErrorY;
  float gyroZ = (GyZ / 131.0) - GyroErrorZ;

  rawData["accelX"] = isnan(accelX) ? 0 : accelX;
  rawData["accelY"] = isnan(accelY) ? 0 : accelY;
  rawData["accelZ"] = isnan(accelZ) ? 0 : accelZ;
  rawData["gyroX"] = isnan(gyroX) ? 0 : gyroX;
  rawData["gyroY"] = isnan(gyroY) ? 0 : gyroY;
  rawData["gyroZ"] = isnan(gyroZ) ? 0 : gyroZ;

  // Calculated angles with NaN checks
  JsonObject angles = doc.createNestedObject("angles");
  angles["roll"] = isnan(roll) ? 0 : roll;
  angles["pitch"] = isnan(pitch) ? 0 : pitch;
  angles["yaw"] = isnan(yaw) ? 0 : yaw;

  // Knee angle (main measurement)
  doc["kneeAngle"] = getKneeAngle();

  // Temperature
  float temperature = Tmp / 340.00 + 36.53;
  doc["temperature"] = isnan(temperature) ? 25.0 : temperature;

  // Send via Bluetooth
  String jsonString;
  serializeJson(doc, jsonString);
  bluetooth.println("KNEE_DATA:" + jsonString);
}

void handleBluetoothCommand(String command) {
  if (command.startsWith("START_SESSION:")) {
    sessionId = command.substring(14);
    isRecording = true;
    Serial.println("Started session: " + sessionId);
    bluetooth.println("SESSION_STARTED:" + sessionId);
  } else if (command == "STOP_SESSION") {
    isRecording = false;
    sessionId = "";
    Serial.println("Session stopped");
    bluetooth.println("SESSION_STOPPED");
  } else if (command.startsWith("SET_EXERCISE:")) {
    exerciseType = command.substring(13).toInt();
    Serial.println("Exercise type set to: " + String(exerciseType));
    bluetooth.println("EXERCISE_SET:" + String(exerciseType));
  } else if (command == "CALIBRATE") {
    calibrateMPU6050();
  } else if (command == "GET_STATUS") {
    bluetooth.println("STATUS:" + String(isRecording ? "RECORDING" : "IDLE") + ":" + sessionId + ":" + String(exerciseType));
  }
}

void printAngleData() {
  Serial.print("Knee Angle: ");
  Serial.print(getKneeAngle());
  Serial.print("° | Roll: ");
  Serial.print(roll);
  Serial.print("° | Pitch: ");
  Serial.print(pitch);
  Serial.print("° | Yaw: ");
  Serial.print(yaw);
  Serial.print("° | Recording: ");
  Serial.println(isRecording ? "YES" : "NO");
}
