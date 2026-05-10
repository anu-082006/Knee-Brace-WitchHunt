# Knee-Braced ML Module Documentation

## Scope
This document describes only the Machine Learning (ML) part of the Knee-Braced project: what it does, how it works, and which files are involved.

## 1) What the ML Module Does

The ML module evaluates a patient's rehabilitation exercise quality using motion data collected from an Arduino-connected device.

At a high level, it:
- Receives a time-series of motion readings (`knee_angle`, `pitch`, `roll`, `yaw`) for one exercise session.
- Compares patient movement against a "healthy reference" dataset for the same exercise.
- Calculates:
  - A **performance score** (0-100)
  - A **recovery stage** classification
  - A **status** recommendation (e.g., ready for progression or continue current stage)
- Returns these outputs to the frontend and stores them for physiotherapist review.

## 2) End-to-End ML Flow

1. **Patient starts exercise recording** in the dashboard.  
2. **Arduino data stream** is parsed in the frontend hook.
3. Readings are buffered up to **200 samples**.
4. On stop (or when buffer reaches 200), frontend sends readings to:
   - `POST http://localhost:8000/analyze`
5. ML service:
   - Loads healthy reference CSV for the selected exercise
   - Standardizes patient sequence to 200 rows
   - Computes ROM and smoothness metrics
   - Produces final score + stage + status
6. Frontend:
   - Displays ML result card to the patient
   - Stores result in Firestore collection `mlAnalysisResults`
7. Physiotherapist view:
   - Reads `mlAnalysisResults`
   - Shows trends and latest evaluations in patient detail panel
   - Includes ML section in generated PDF report

## 3) ML Service Behavior (Core Logic)

### Input Contract
Endpoint: `POST /analyze`

Payload shape:
- `exercise_name: string`
- `readings: Array<{ knee_angle: number, pitch: number, roll: number, yaw: number }>`

### Processing Steps

#### A. Healthy Reference Selection
- The service maps exercise name to:
  - `library/healthy_<exercise_name_with_underscores>.csv`
- If the file does not exist, it returns HTTP 404.

#### B. Standardization
- Patient readings may vary in length.
- Service interpolates all 4 channels (`knee_angle`, `pitch`, `roll`, `yaw`) to exactly **200 rows** using linear interpolation.
- This makes comparisons consistent across sessions.

#### C. Scoring
- **Range of Motion (ROM) score**  
  - Based on patient's ROM ratio vs healthy ROM, capped at 1.0
- **Smoothness score**  
  - Uses average absolute first-difference as a jitter proxy
  - Penalizes high jitter relative to healthy jitter baseline
- **Total score**  
  - Weighted combination:
    - `70% ROM`
    - `30% smoothness`
  - Converted to percentage (0-100), rounded to 1 decimal place

#### D. Stage Classification
- `< 40` -> `Stage 1: Early Recovery`
- `< 70` -> `Stage 2: Strengthening`
- `>= 70` -> `Stage 3: Advanced Mobility`

#### E. Status Rule
- If score `> 80` -> `Ready`
- Else -> `Continue Current Stage`

### Output Contract
JSON response:
- `performance_score: number`
- `recovery_stage: string`
- `status: string`

## 4) Files Involved (ML-Only View)

## A) Core ML Backend

- `ml-service/main.py`  
  Main FastAPI service with `/analyze` endpoint, interpolation, scoring, and stage prediction.

- `ml-service/requirements.txt`  
  Python dependencies used by ML service runtime.

## B) Healthy Reference Dataset Library

All reference templates are stored under:
- `ml-service/library/`

Files currently present:
- `healthy_Ankle_Pumps.csv`
- `healthy_Bridges.csv`
- `healthy_Heel_Raises.csv`
- `healthy_Heel_Slides.csv`
- `healthy_Lunges.csv`
- `healthy_Quad_Sets.csv`
- `healthy_Running_Simulation.csv`
- `healthy_Seated_Knee_Extension.csv`
- `healthy_Side_Leg_Balance.csv`
- `healthy_Side_Leg_Raises.csv`
- `healthy_Single-leg_Squats.csv`
- `healthy_Squats.csv`
- `healthy_Step_Hops.csv`
- `healthy_Step-ups.csv`
- `healthy_Straight_Leg_Raises.csv`
- `healthy_Wall_Slides.csv`

These CSVs act as exercise-specific "healthy digital twin" baselines.

## C) Frontend Integration Files

- `client/src/hooks/useArduinoConnection.ts`  
  ML integration orchestrator on client side:
  - Buffers readings
  - Calls `http://localhost:8000/analyze`
  - Stores result in Firestore `mlAnalysisResults`
  - Exposes `mlFeedback` and `readingCount` to UI

- `client/src/pages/PatientDashboard.tsx`  
  Displays patient-side ML output:
  - Performance score
  - Recovery stage
  - Status
  - Recording progress (`readingCount / 200`)

- `client/src/components/PatientDetailDialog.tsx`  
  Physiotherapist-side ML result consumption:
  - Queries `mlAnalysisResults` by `patientId`
  - Renders ML performance cards
  - Adds ML section into downloadable PDF report

## 5) Data Persistence for ML Results

ML output is persisted by frontend to Firestore:
- Collection: `mlAnalysisResults`
- Stored fields:
  - `patientId`
  - `exerciseId`
  - `exerciseName`
  - `timestamp`
  - `performance_score`
  - `recovery_stage`
  - `status`
  - `sampleCount`

This enables historical review by physiotherapists.

## 6) Assumptions and Runtime Dependencies

- ML service is expected to run separately (FastAPI/Uvicorn) on port `8000`.
- Frontend currently calls ML service directly at `http://localhost:8000/analyze`.
- CORS in ML service is configured permissively (`allow_origins=["*"]`) for development compatibility.
- Exercise name sent by frontend must match available healthy CSV naming convention.

## 7) Current Strengths of ML Module

- Lightweight, explainable scoring logic (not a black-box model).
- Works with variable-length sessions via interpolation.
- Exercise-specific comparison through reference templates.
- End-to-end integration from capture -> inference -> UI -> persisted result.

## 8) Known Limitations (Current Implementation)

- Uses heuristic biomechanical scoring rather than trained predictive model inference.
- Single endpoint and fixed scoring weights (70/30) with static thresholds.
- Relies on local ML service URL in frontend.
- Missing explicit input validation for malformed reading objects beyond Pydantic shape.
- `xgboost` is listed in dependencies but not used in current `main.py`.

## 9) Summary

The ML part of Knee-Braced is a practical rehabilitation analytics pipeline:
- It compares patient motion sessions against healthy exercise baselines,
- Computes objective performance metrics,
- Predicts recovery stage,
- And makes results visible to both patients and physiotherapists.

Files are clearly split into:
- ML backend computation (`ml-service/*`),
- reference datasets (`ml-service/library/*`),
- and frontend integration/display layers (`client/src/...`).
