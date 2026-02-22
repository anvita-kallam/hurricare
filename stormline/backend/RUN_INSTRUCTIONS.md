# 🚀 HurriCare Backend - How to Run

## Quick Start (30 seconds)

```bash
cd /Users/navyanori/Desktop/hurricares/hurricare/stormline/backend

# Run the backend server
python3 -m uvicorn main:app --reload --port 8000
```

Server will be available at: **http://localhost:8000**

## What You'll See

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Test the API

In another terminal:

```bash
# Get all hurricanes
curl http://localhost:8000/hurricanes | jq '.[:2]'

# Get all projects
curl http://localhost:8000/projects | jq '.[:2]'

# Get coverage analysis
curl http://localhost:8000/coverage | jq '.[:2]'

# Find matching hurricane
curl 'http://localhost:8000/hurricanes/match?region=USA&category=3'
```

## Interactive API Documentation

Open in your browser:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

Click "Try it out" on any endpoint!

## All Available Endpoints

```
GET /
  → Check API is running

GET /hurricanes
  → Get all hurricanes with tracks and affected countries

GET /hurricanes/match
  → Find hurricane matching region, category, and direction
  → Params: region, category, direction (optional)

GET /projects
  → Get all projects
  → Params: hurricane_id (optional), country (optional)

GET /coverage
  → Get coverage ratios for all regions
  → Params: hurricane_id (optional)

GET /coverage/all
  → Get all regional coverage data

GET /flagged
  → Get flagged projects (outlier detection)
  → Params: hurricane_id (optional)

POST /simulate
  → Simulate allocation impact
  → Body: { "hurricane_id": "...", "allocations": {...} }

POST /stage1
  → User plan simulation

POST /stage2
  → ML ideal plan simulation

POST /stage3
  → Real-world scenario

POST /compare
  → Compare stages

GET /leaderboard
  → Get daily leaderboard
```

## Database Status

The backend is using **DuckDB (local in-memory)** by default.

To switch to Databricks SQL Warehouse:
1. Create `.env` file with your Databricks credentials
2. Restart the server
3. It automatically detects and switches!

## Stop the Server

Press **Ctrl+C** in the terminal running the server.

## Troubleshooting

### Port already in use
```bash
# Kill any existing process on port 8000
lsof -ti:8000 | xargs kill -9
```

### Module not found
```bash
# Install missing dependencies
pip install -r requirements.txt
```

### Import errors
```bash
# Test main.py imports
python3 -c "import main; print('OK')"
```

## What's Running

- **Backend Framework**: FastAPI (Python)
- **Database**: DuckDB (in-memory, local)
- **Server**: Uvicorn (ASGI server)
- **Hot Reload**: Enabled (code changes auto-reload)

## Architecture

```
Your Browser/Frontend
      ↓
FastAPI Application (main.py)
      ↓
Data Layer (data_loader.py)
      ↓
DuckDB Database (in-memory)
      ↓
CSV/JSON Sample Data
```

## Integration Features

Both DuckDB AND Databricks work with same code:
- `DuckDBPyConnection` (local)
- `DatabricksConnection` (cloud)
Same API → No code changes needed!

---

**Ready?** Run: `python3 -m uvicorn main:app --reload --port 8000`
