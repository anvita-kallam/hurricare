# Deploy HurriCare on Railway

HurriCare runs as **two Railway services**: a FastAPI backend and a Vite/React frontend.

## Architecture

```
Browser → Frontend (static React app)
              ↓ VITE_API_URL
         Backend (FastAPI + DuckDB)
              ↓ optional
         Databricks / Gemini / ElevenLabs APIs
```

## Prerequisites

- [Railway account](https://railway.app)
- GitHub repo connected: `https://github.com/anvita-kallam/hurricare`
- Push the latest code (including these deployment files) to GitHub

## Step 1: Deploy the backend

1. In Railway, click **New Project** → **Deploy from GitHub repo** → select `hurricare`
2. Railway creates a service — open **Settings** → **Root Directory** → set:
   ```
   stormline/backend
   ```
3. Under **Variables**, add any secrets you need:

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `CORS_ORIGINS` | Yes (after frontend deploy) | Your frontend URL, e.g. `https://hurricare-frontend-production.up.railway.app` |
   | `DATABRICKS_SERVER_HOSTNAME` | No | Databricks SQL warehouse host |
   | `DATABRICKS_HTTP_PATH` | No | SQL warehouse HTTP path |
   | `DATABRICKS_PAT` | No | Databricks personal access token |
   | `GEMINI_API_KEY` | No | Google Gemini (insights + narratives) |
   | `ELEVENLABS_API_KEY` | No | ElevenLabs voice narration |

4. Deploy. Copy the public backend URL (e.g. `https://hurricare-backend-production.up.railway.app`)
5. Verify: open `https://<your-backend-url>/hurricanes` — you should see JSON

## Step 2: Deploy the frontend

1. In the same Railway project, click **+ New** → **GitHub Repo** → select `hurricare` again
2. Open **Settings** → **Root Directory** → set:
   ```
   stormline/frontend
   ```
3. Under **Variables**, add:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | Your backend URL from Step 1 (no trailing slash) |

4. Deploy. Railway builds the Vite app and serves `dist/` with `serve`
5. Copy the frontend public URL

## Step 3: Link frontend ↔ backend

1. Go back to the **backend** service → **Variables**
2. Set `CORS_ORIGINS` to your frontend URL:
   ```
   https://hurricare-frontend-production.up.railway.app
   ```
3. Redeploy the backend so CORS picks up the new origin

## Step 4: Test

Open your frontend URL and confirm:

- [ ] Hurricane list loads on the globe
- [ ] Coverage data appears
- [ ] Simulation / game flow works
- [ ] Leaderboard submits scores

## Local production build test

Before deploying, you can verify the production build locally:

```bash
# Terminal 1 — backend
cd stormline/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — frontend
cd stormline/frontend
npm install
VITE_API_URL=http://localhost:8000 npm run build
npm start
```

Open `http://localhost:4173`.

## Troubleshooting

### CORS errors in browser console
- Ensure `CORS_ORIGINS` on the backend exactly matches your frontend URL (including `https://`)
- Redeploy backend after changing `CORS_ORIGINS`

### Backend build fails during `pip install -r requirements.txt`
- Railway/Railpack may default to Python 3.12+ with an older pip that corrupts PyPI metadata (`JSONDecodeError`)
- This repo pins Python **3.11** via `.python-version`, `runtime.txt`, and `RAILPACK_PYTHON_VERSION`
- `railpack.json` upgrades pip before installing dependencies
- If it still fails, set this variable on the backend service: `RAILPACK_INSTALL_CMD=pip install --upgrade pip setuptools wheel && pip install --no-cache-dir -r requirements.txt`

### Frontend build fails with `EBUSY: rmdir '/app/node_modules/.cache'`
- Do **not** run `npm ci` or `npm install` in the Railway build command — Railpack already installs dependencies
- The frontend `railway.toml` should use `buildCommand = "npm run build"` only

### API calls fail / network errors
- Confirm `VITE_API_URL` is set on the frontend service **before** the build runs
- Railway rebuilds when you change variables — trigger a redeploy after updating `VITE_API_URL`

### Backend build fails on DuckDB/scipy
- Railway uses Nixpacks with Python 3.11 by default; if needed, add a `runtime.txt` with `python-3.11`

### Voice / AI features don't work
- `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` are optional; some features degrade gracefully without them
- Gemini insights also accept a client-side API key in the comparison UI

## Cost note

Railway's free trial includes $5/month of usage. The backend (Python + scipy) uses more resources than the static frontend. Consider sleeping unused services or upgrading if traffic grows.
