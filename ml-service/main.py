from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
from scipy.interpolate import interp1d
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# Enable CORS so your React app can talk to this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExerciseData(BaseModel):
    exercise_name: str
    readings: list  # List of dicts: [{'knee_angle':..., 'pitch':..., 'roll':..., 'yaw':...}]

def standardize_data(df, target_rows=200):
    """Interpolates any length input to exactly 200 rows."""
    x_old = np.linspace(0, 1, len(df))
    x_new = np.linspace(0, 1, target_rows)
    standardized = {}
    for col in ['knee_angle', 'pitch', 'roll', 'yaw']:
        f = interp1d(x_old, df[col], kind='linear', fill_value="extrapolate")
        standardized[col] = f(x_new)
    return pd.DataFrame(standardized)

@app.post("/analyze")
async def analyze_rehab(data: ExerciseData):
    # 1. Load Healthy Digital Twin
    file_name = f"library/healthy_{data.exercise_name.replace(' ', '_')}.csv"
    if not os.path.exists(file_name):
        raise HTTPException(status_code=404, detail=f"Healthy dataset for {data.exercise_name} not found.")
    
    df_h = pd.read_csv(file_name)
    df_p = pd.DataFrame(data.readings)

    # 2. Standardize Patient Data to 200 rows
    df_p_std = standardize_data(df_p)

    # 3. Biomechanical Comparison Logic
    h_rom = df_h['knee_angle'].max() - df_h['knee_angle'].min()
    p_rom = df_p_std['knee_angle'].max() - df_p_std['knee_angle'].min()
    
    # Range of Motion Score
    rom_score = min(p_rom / (h_rom + 1e-5), 1.0)
    
    # Smoothness Score (Inverse of Jitter)
    h_jitter = df_h['knee_angle'].diff().abs().mean()
    p_jitter = df_p_std['knee_angle'].diff().abs().mean()
    smoothness_score = max(0, 1 - (p_jitter / (h_jitter * 5 + 1e-5))) 

    # Weighted Performance Score
    total_score = round(((0.7 * rom_score) + (0.3 * smoothness_score)) * 100, 1)

    # 4. Stage Prediction
    if total_score < 40: stage = "Stage 1: Early Recovery"
    elif total_score < 70: stage = "Stage 2: Strengthening"
    else: stage = "Stage 3: Advanced Mobility"

    return {
        "performance_score": total_score,
        "recovery_stage": stage,
        "status": "Ready" if total_score > 80 else "Continue Current Stage"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)