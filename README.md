# OrthoConnect (Knee-Braced)

Web application for knee rehabilitation: patients connect an IMU-based device over **Web Serial**, complete assigned exercises, and receive **ML performance feedback** plus **AI exercise recommendations** from **n8n**. Physiotherapists review progress in Firebase-backed dashboards.

## What is in this repository

| Area | Description |
|------|-------------|
| **`client/`** | React (Vite) UI: auth, patient dashboard, Arduino panel, live readings, ML card, exercise GIFs, n8n recommendations. |
| **`server/`** | Express API: health, optional storage routes, **n8n production proxy** (`POST /api/n8n/patient-query`), Vite dev middleware in development. |
| **`ml-service/`** | FastAPI service on port **8000**: `POST /analyze` compares patient motion to CSV baselines in `ml-service/library/`. |
| **`firmware/`** | Arduino / PlatformIO sketch for the knee brace sensor stream. |
| **`functions/`** | Firebase Cloud Functions (if you deploy backend logic to Firebase). |
| **`shared/`** | Shared TypeScript types/schemas used by client and server. |

## Prerequisites

- **Node.js** 18+ and npm  
- **Firebase** project (Auth + Firestore) — config is wired in `client/src/lib/firebase.ts` (replace with your own or use env-based config for production)  
- **n8n** workflow with a webhook URL matching production (see Environment)  
- **Chrome or Edge** (or another browser with **Web Serial API**) for patient device connection  
- **Python 3.11+** recommended for `ml-service` (fewer wheel issues than bleeding-edge Python)

## Quick start (local development)

### 1. Install and run the web app

```bash
npm install
npm run dev
```

The dev server prints a URL such as `http://localhost:5000` (or the next free port if 5000 is in use). Open that URL in the browser — **Express and Vite share one port**; use only this origin so `/api/...` routes resolve correctly.

### 2. Run the ML service (required for analysis scores)

In a **second** terminal:

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -U pip setuptools wheel
pip install -r requirements.txt
python main.py
```

Confirm **`http://localhost:8000/docs`** loads. The patient dashboard calls **`http://localhost:8000/analyze`** from the browser for ML; keep this service running while testing recording and analysis.

### 3. Firebase

Ensure your Firebase project has **Email/Password** (or your chosen providers) enabled and **Firestore** created. Security rules live in `firestore.rules`; deployment steps are in **`DEPLOYMENT.md`**.

### 4. Arduino / firmware

See **`firmware/README.md`** for building and uploading the sketch (PlatformIO or Arduino IDE).

## How to use the app (typical flow)

1. **Sign in** as a patient or physiotherapist (role-based UI).  
2. **Patient**: open the dashboard, **Connect** the serial device, pick an assigned exercise, **Start recording**, move through the exercise, **Stop** (or wait until the buffer fills — up to **200 samples** — for automatic analysis).  
3. **ML**: results appear in the **Performance Analysis** card when the analyze request succeeds; results can also be written to Firestore (`mlAnalysisResults`) for the physio view.  
4. **Recommendations**: the dashboard loads n8n suggestions (direct webhook from the browser when allowed, or via **`POST /api/n8n/patient-query`** if the browser cannot call n8n directly).  
5. **Physiotherapist**: patient detail views and PDF export can include stored readings and ML history where implemented.

Exercise names sent to ML must match files under `ml-service/library/` (e.g. `Heel Slides` → `healthy_Heel_Slides.csv`). Exercise GIFs are served from the repo `gifs/` folder in dev.

## Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `N8N_WEBHOOK_URL` | `server/routes.ts` | Override production n8n webhook URL for `POST /api/n8n/patient-query`. |
| `PORT` | `server/index.ts` | HTTP port (default `5000`; server may try the next port if busy). |

Client-side n8n and webhook URLs in `PatientDashboard.tsx` / `useArduinoConnection.ts` should stay aligned with your live n8n workflow URL.

## Production build

```bash
npm run build
npm start
```

`npm start` runs the bundled server from `dist/`. Ensure the ML service is deployed and reachable from users’ browsers if you keep calling `localhost:8000` from the client — for hosted deployments you typically expose ML behind HTTPS or proxy through your API.

## Documentation

- **`DEPLOYMENT.md`** — Firebase hosting, functions, and Firestore deployment.  
- **`Knee-Braced_ML_Module_Detailed_Documentation.md`** — ML API contract and scoring behavior.  
- **`firmware/README.md`** — Device firmware.

## Contributing and GitHub

```bash
git status
git add README.md server/routes.ts client/src/pages/PatientDashboard.tsx
# add any other files you changed
git commit -m "Add project README; remove n8n test route and use production proxy only"
git push origin main
```

Replace `main` with your branch name if different. Do not commit `node_modules/` or build artifacts; ensure `.gitignore` covers them.

## License

MIT (see `package.json`).
