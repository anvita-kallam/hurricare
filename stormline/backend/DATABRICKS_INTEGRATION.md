# Databricks SQL Warehouse Integration Guide

This guide shows how to swap your local DuckDB backend for **Databricks SQL Warehouse + Delta Lake** (production-ready).

## Architecture

```
Before (Local Development):
Frontend → FastAPI → DuckDB (in-memory) → CSV/JSON files

After (Production with Databricks):
Frontend → FastAPI → Databricks SQL Warehouse → Delta Lake (cloud storage)
           ↓
       Same endpoints, same schemas, same logic
```

## What Changed (Minimal)

- ✅ **Backend logic**: 0 changes
- ✅ **Frontend**: 0 changes  
- ✅ **API endpoints**: 0 changes
- ✅ **Models/schemas**: 0 changes
- ❌ Only the storage layer (`DuckDB` → `Databricks`)

## Setup Steps

### 1. Get Databricks Credentials (5 minutes)

You need:
1. **Databricks Workspace**: Sign up for free at https://databricks.com
2. **SQL Warehouse**: Create a SQL Warehouse in your workspace (SQL > Warehouses > Create)
3. **Personal Access Token (PAT)**: Settings > User Settings > Access Tokens > Generate

You'll get:
```
DATABRICKS_SERVER_HOSTNAME = adb-1234567890.azuredatabricks.net
DATABRICKS_HTTP_PATH = /sql/1.0/warehouses/abc123def456xyz
DATABRICKS_PAT = dapi1234567890abcdef...
```

### 2. Update Backend Dependencies (2 minutes)

```bash
cd stormline/backend
pip install -r requirements.txt
```

New dependencies added:
- `requests` - for Databricks REST API
- `databricks-sql-connector` - optional, for native connector
- `python-dotenv` - for loading .env config

### 3. Configure Environment (2 minutes)

Create `.env` file in `backend/` directory:

```bash
cp .env.example .env
```

Edit `.env` and fill in your Databricks credentials:

```ini
DATABRICKS_SERVER_HOSTNAME=adb-1234567890.azuredatabricks.net
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/abc123def456xyz
DATABRICKS_PAT=dapi1234567890abcdef...
```

### 4. Load Data to Databricks (5 minutes, one-time)

Run the data loader script to create Delta tables:

```bash
cd stormline/backend
python data_loader_databricks.py
```

This will:
1. Create 4 Delta tables in Databricks:
   - `hurricanes` (hurricane metadata + track data)
   - `projects` (project allocation data)
   - `severity` (regional severity & population data)
   - `ideal_plans` (reference response plans)

2. Load your sample CSV/JSON data from `sample_data/`

### 5. Run the Backend (2 minutes)

```bash
cd stormline/backend

# Install dev dependencies if not already done
pip install -r requirements.txt

# Start FastAPI server
uvicorn main:app --reload
```

FastAPI will detect the Databricks environment variables and automatically:
1. Connect to your SQL Warehouse
2. Route all queries through Databricks REST API
3. Keep the same response format as before

## How It Works (Technical)

### DuckDB Mode (Local, default)
```python
# Automatic when DATABRICKS_* env vars are NOT set
db = duckdb.connect(':memory:')
result = db.execute("SELECT * FROM hurricanes")
```

### Databricks Mode (Production)
```python
# Automatic when DATABRICKS_* env vars ARE set
from databricks_client import DatabricksConnection
db = DatabricksConnection(
    server_hostname="...",
    http_path="...",
    personal_access_token="..."
)
result = db.execute("SELECT * FROM hurricanes")
```

Both return the same format → API endpoints unchanged!

## Code Changes Summary

### New Files
- `databricks_client.py` - Lightweight wrapper for Databricks SQL Warehouse REST API
- `data_loader_databricks.py` - One-time script to load data into Databricks
- `.env.example` - Config template

### Modified Files
- `data_loader.py` - Added auto-detection of Databricks vs DuckDB
- `requirements.txt` - Added Databricks dependencies

### Unchanged Files
- `main.py` - Same endpoints, same behavior
- `analysis.py` - Same query logic
- `simulation_engine.py` - Same simulation logic
- `schemas.py` - Same models
- `frontend/` - 0 changes

## Verification

Test the integration:

```bash
# Terminal 1: Start backend
cd stormline/backend
uvicorn main:app --reload

# Terminal 2: Test API
curl http://localhost:8000/hurricanes
curl "http://localhost:8000/hurricanes/match?region=USA&category=3"
```

Should return the same data as DuckDB version!

## Performance & Scaling

### With Databricks SQL Warehouse:
- ✅ **Shared storage** across multiple backend instances
- ✅ **Automatic scaling** (SQL Warehouse handles peak load)
- ✅ **Data versioning** (Delta Lake ACID transactions)
- ✅ **Easy data updates** (no app restart needed)
- ✅ **Live analytics** (Databricks dashboard on same data)

### Cost
- Free trial: $0 for 14 days + $1000 credits
- Production: ~$1-5/day for SQL Warehouse (pay-per-query)

## Production Checklist

For a real deployment:

- [ ] Set SQL Warehouse to auto-scale or appropriate cluster size
- [ ] Use Databricks secrets manager instead of .env (recommended)
- [ ] Enable Databricks Unity Catalog for data governance
- [ ] Add table maintenance (OPTIMIZE) periodically
- [ ] Monitor SQL Warehouse query performance via Databricks UI
- [ ] Set up Delta table snapshots for audit trail

## Rollback (If needed)

To switch back to DuckDB:

1. Remove or comment out the `DATABRICKS_*` env vars
2. Run backend again
3. Everything reverts to in-memory DuckDB (instant)

## Troubleshooting

### Connection timeout
```
Error: Query execution exceeded 60s
```
Solution: Increase `warehouse_timeout_seconds` in `databricks_client.py` or increase SQL Warehouse cluster size in Databricks UI.

### Credentials invalid
```
Error: 401 Unauthorized
```
Solution: 
1. Verify PAT is still valid (check Databricks > Settings > Tokens)
2. Check DATABRICKS_SERVER_HOSTNAME format (no `https://`)
3. Check DATABRICKS_HTTP_PATH starts with `/sql/`

### Table not found
```
Error: table 'hurricanes' not found
```
Solution: Run `python data_loader_databricks.py` to create/load tables.

## FAQ

**Q: Do I need to change my frontend?**
A: No. Same API endpoints, same response format.

**Q: Do I need to change my analysis logic?**
A: No. Same SQL queries, same Python code.

**Q: Can I use Autonomous Data Warehouse (ADW) instead?**
A: Yes! Just point to your ADW SQL endpoint instead of SQL Warehouse.

**Q: How do I store stage outputs (stage1_user_plans, etc.)?**
A: Create extra Delta tables in Databricks and insert results:
```python
db.execute("""
    INSERT INTO stage1_user_plans 
    SELECT ... FROM projects WHERE ...
""")
```

**Q: What about backups?**
A: Databricks handles backups automatically. Delta Lake also provides time-travel:
```sql
SELECT * FROM hurricanes VERSION AS OF 10  -- Restore previous version
```

---

## For Hackathon Judges

**Pitch**: "We prototyped locally with DuckDB, but production uses Databricks SQL Warehouse + Delta Lake—a governed cloud lakehouse. Our backend architecture is cloud-native and scales instantly."

**Demo talking points**:
1. Show endpoint returning data from Databricks (not local CSV)
2. Open Databricks SQL editor, show live queries
3. Mention: Same code, zero migration risk, instant scaling
4. Optional: Show Delta table history (version control for data)

---

## Next Steps

1. [Sign up for Databricks free trial](https://databricks.com)
2. Create SQL Warehouse (takes 2 minutes)
3. Copy credentials to `.env`
4. Run `python data_loader_databricks.py`
5. Start backend with `uvicorn main:app --reload`
6. Verify with `curl http://localhost:8000/hurricanes`

**Total setup time: ~15 minutes**
