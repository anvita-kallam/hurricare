# HurriCare Backend

FastAPI backend for the HurriCare hurricane response optimization dashboard.

## Quick Start (Local Development)

```bash
# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn main:app --reload
```

Backend runs on `http://localhost:8000`

**Default**: Uses local in-memory DuckDB (instant startup, no config needed)

## Production: Databricks SQL Warehouse Integration

For a **production-ready, cloud-backed** version with Delta Lake:

1. **Read**: [DATABRICKS_INTEGRATION.md](DATABRICKS_INTEGRATION.md) (5-min guide)
2. **Setup**: 
   ```bash
   bash setup_databricks.sh
   # or manually: cp .env.example .env
   ```
3. **Start**: 
   ```bash
   uvicorn main:app --reload
   ```

Same endpoints, same code, different storage layer.

## Architecture

**Local (Default)**
```
FastAPI → DuckDB (in-memory) → CSV/JSON
```

**Production (Databricks)**
```
FastAPI → Databricks SQL Warehouse → Delta Lake (cloud storage)
```

## Features

- ✅ Project allocation and coverage analysis
- ✅ Hurricane matching and region filtering
- ✅ Flagged outlier detection (IQR-based)
- ✅ Three-stage simulation (User / ML-Ideal / Real-World)
- ✅ Daily leaderboard tracking
- ✅ Flexible allocation impact assessment

## API Endpoints

All endpoints work with both DuckDB and Databricks (no changes needed):

- `GET /hurricanes` - All hurricanes
- `GET /hurricanes/match?region=X&category=Y` - Find matching hurricane
- `GET /projects?hurricane_id=X` - Projects for hurricane
- `GET /coverage?hurricane_id=X` - Coverage analysis
- `GET /coverage/all` - All regions coverage
- `GET /flagged?hurricane_id=X` - Outlier projects
- `POST /simulate` - Simulate allocation impact
- `POST /stage1` - User plan simulation
- `POST /stage2` - ML ideal plan
- `POST /stage3` - Real-world scenario
- `POST /compare` - Compare stages

## Development

### Running Tests
```bash
# Run integration tests
pytest tests/ -v
```

### Adding New Features
1. Update schemas in `schemas.py`
2. Add analysis logic in `analysis.py` or `simulation_engine.py`
3. Add endpoint in `main.py`
4. Both DuckDB and Databricks will work (same SQL)

### Database Schema

#### hurricanes
```
id, name, year, max_category, track (JSON), affected_countries (JSON), estimated_population_affected
```

#### projects
```
project_id, hurricane_id, country, admin1, cluster, budget_usd, beneficiaries, pooled_fund, implementing_partner
```

#### severity
```
hurricane_id, admin1, severity_index, estimated_people_in_need
```

#### ideal_plans
```
id, name, year, affected_countries, estimated_population_affected, ideal_plan_text
```

## Configuration

### DuckDB Mode (Local)
- No config needed
- Loads from `sample_data/` on startup
- Data lost when server restarts

### Databricks Mode (Production)
Create `.env` file:
```ini
DATABRICKS_SERVER_HOSTNAME=adb-xxxx.azuredatabricks.net
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/xxxxx
DATABRICKS_PAT=dapixxx...
```

See [.env.example](.env.example) for more details.

## Troubleshooting

**"Table not found" error**
- DuckDB: Server restarted? Tables are in-memory, reload required
- Databricks: Run `python data_loader_databricks.py`

**"Connection refused"**
- Check Databricks SQL Warehouse is running
- Verify credentials in `.env`

**Slow queries**
- DuckDB: Normal for large datasets in-memory
- Databricks: Increase warehouse size in UI or add WHERE filters

## Performance

| Operation | DuckDB | Databricks |
|-----------|--------|-----------|
| Query 1K projects | ~10ms | ~500ms (includes API latency) |
| Load data | Instant (in-memory) | 2-3s (network) |
| Concurrent requests | Limited (in-process) | Unlimited (cloud) |
| Data persistence | None | ✅ Automatic |
| Scaling | Vertical only | ✅ Automatic |

## Architecture Notes

### Query Flow
1. FastAPI endpoint receives request
2. `db.execute(sql)` sends query
3. For DuckDB: returns in-memory result
4. For Databricks: REST API → SQL Warehouse → Delta Lake
5. Both return `DatabricksQueryResult` (mimics DuckDB format)
6. Endpoint formats response

### Database Abstraction
- `DatabricksConnection` class in `databricks_client.py`
- Mimics DuckDB's `.execute()` interface
- Auto-detects based on environment variables
- Zero changes needed in `analysis.py` or `simulation_engine.py`

### Thread Safety
- DuckDB: Per-request lock in `main.py` (single connection)
- Databricks: Connection-safe (each request gets own API call)

## For Hackathon Judges

**Talking Points**:
1. "Built to scale: prototyped with DuckDB, production-ready with Databricks"
2. "Same API, different backend: risk-free migration"
3. "Delta Lake provides data versioning and ACID guarantees"
4. "SQL Warehouse auto-scales with demand"

**Live Demo**:
```bash
# Show Databricks connection working
curl http://localhost:8000/hurricanes | head -20

# Open Databricks SQL editor
# Run: SELECT COUNT(*) FROM hurricanes
# Show live data in warehouse
```

## Contributing

Pull requests welcome! Keep same coding style and ensure both DuckDB and Databricks work.

---

**Need help?** See [DATABRICKS_INTEGRATION.md](DATABRICKS_INTEGRATION.md) for detailed setup guide.
