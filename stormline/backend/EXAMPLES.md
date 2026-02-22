# Code Examples: Databricks Integration

## Quick Reference Guide

### Example 1: Using Backend with DuckDB (Default)

**Setup**
```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

**What happens inside**
```python
# main.py: Line 48
db = initialize_database()

# data_loader.py: initialize_database()
# Checks environment variables...
if DATABRICKS_SERVER_HOSTNAME:  # Not set
    # Use Databricks
else:  # True (not set)
    # Use DuckDB
    db = duckdb.connect(':memory:')
    # Load CSV/JSON files
    db.execute("CREATE TABLE hurricanes ...")
    # ...
```

**Result**: In-memory DuckDB, instant data load

---

### Example 2: Using Backend with Databricks

**Setup**
```bash
# Create .env file
cat > .env << 'EOF'
DATABRICKS_SERVER_HOSTNAME=adb-1234567890.azuredatabricks.net
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/abc123def456
DATABRICKS_PAT=dapi1234567890abcdef
EOF

# Load data once
python data_loader_databricks.py

# Start backend
uvicorn main:app --reload
```

**What happens inside**
```python
# main.py: Line 48
db = initialize_database()

# data_loader.py: initialize_database()
# Checks environment variables...
if DATABRICKS_SERVER_HOSTNAME:  # "adb-1234567890.azuredatabricks.net"
    # Use Databricks ✓
    from databricks_client import DatabricksConnection
    db = DatabricksConnection(
        server_hostname="adb-1234567890.azuredatabricks.net",
        http_path="/sql/1.0/warehouses/abc123def456",
        personal_access_token="dapi1234567890abcdef"
    )
```

**Result**: Cloud SQL Warehouse, persisted Delta tables

---

### Example 3: Same Endpoint Works with Both

```python
# main.py: get_hurricanes() endpoint
@app.get("/hurricanes", response_model=List[Hurricane])
def get_hurricanes():
    global db
    result = db.execute("SELECT * FROM hurricanes ORDER BY year DESC, name ASC")
    results = result.fetchall()
    # ... format and return
```

**Execution with DuckDB**
```
execute("SELECT...")
  ↓ (duckdb.DuckDBPyConnection)
  ↓ In-memory table lookup
  ↓ Return 10ms
→ FastAPI returns JSON
```

**Execution with Databricks**
```
execute("SELECT...")
  ↓ (DatabricksConnection)
  ↓ REST POST /api/2.0/statements (SQL Warehouse)
  ↓ Poll every 500ms until done
  ↓ Parse result from warehouse
  ↓ Return 500-2000ms
→ FastAPI returns same JSON
```

**Frontend sees**: Identical response, doesn't care about latency

---

### Example 4: DatabricksConnection Class (Wrapper)

How it mimics DuckDB:

```python
# database_client.py

class DatabricksConnection:
    def execute(self, sql: str, params=None):
        # Parameter substitution
        if params:
            for param in params:
                sql = sql.replace("?", format_value(param), 1)
        
        # Send to Databricks REST API
        result = self._execute_query(sql)
        
        # Parse and return DuckDB-like result
        columns = [col["name"] for col in result["manifest"]["columns"]]
        rows = result["result"]["data_array"]
        
        return DatabricksQueryResult(columns, rows)

class DatabricksQueryResult:
    def fetchall(self):
        """Same as DuckDB"""
        return [tuple(row) for row in self.rows]
    
    def fetchone(self):
        """Same as DuckDB"""
        if self._index < len(self.rows):
            return tuple(self.rows[self._index])
        return None
```

**Usage**:
```python
# Works identical with DuckDB or Databricks
result = db.execute("SELECT * FROM projects WHERE budget_usd > ?", [1000000])
for row in result.fetchall():
    print(row)
```

---

### Example 5: One-Time Data Load (Databricks)

```python
# data_loader_databricks.py

def initialize_databricks(server_hostname, http_path, personal_access_token):
    conn = DatabricksConnection(...)
    
    # Load hurricanes
    hurricanes = load_json_data("sample_data/hurricanes.json")
    
    # Create Delta table
    conn.create_table("hurricanes", {
        "id": "STRING",
        "name": "STRING",
        "year": "INT",
        "max_category": "INT",
        "track": "STRING",
        "affected_countries": "STRING",
        "estimated_population_affected": "INT"
    })
    
    # Insert rows
    rows = [
        [h['id'], h['name'], h['year'], ...],
        [h['id'], h['name'], h['year'], ...],
        ...
    ]
    conn.insert_rows("hurricanes", 
        ["id", "name", "year", ...], 
        rows)
```

**Result**: 
- Hurricanes table in Databricks
- Persists across server restarts
- Can be queried from Databricks SQL editor

---

### Example 6: Configuration Detection

```python
# data_loader.py: initialize_database()

import os
from databricks_client import DatabricksConnection

def initialize_database(data_dir: str = "sample_data"):
    # Check Databricks config
    server = os.getenv("DATABRICKS_SERVER_HOSTNAME")
    path = os.getenv("DATABRICKS_HTTP_PATH")
    pat = os.getenv("DATABRICKS_PAT")
    
    if server and path and pat:
        # Use cloud
        print("Using Databricks SQL Warehouse backend")
        return DatabricksConnection(
            server_hostname=server,
            http_path=path,
            personal_access_token=pat
        )
    
    # Default: local
    print("Using local DuckDB backend")
    return duckdb.connect(':memory:')
```

**Magic**: 
- If env vars exist → Databricks
- If not → DuckDB
- No code changes needed, automatic detection

---

### Example 7: Query Parameter Substitution

```python
# How parameters work in both systems

# Query with ? placeholders
sql = "SELECT * FROM projects WHERE hurricane_id = ? AND budget_usd > ?"
params = ["irma_2017", 1000000]

# DuckDB
result = duckdb_conn.execute(sql, params)
# DuckDB handles substitution internally

# Databricks (wrapper handles it)
result = databricks_conn.execute(sql, params)

# Inside DatabricksConnection.execute()
if params:
    for param in params:
        if isinstance(param, str):
            escaped = param.replace("'", "''")
            sql = sql.replace("?", f"'{escaped}'", 1)
        elif isinstance(param, int):
            sql = sql.replace("?", str(param), 1)

# Result: "SELECT * FROM projects WHERE hurricane_id = 'irma_2017' AND budget_usd > 1000000"
```

---

### Example 8: Async Polling (Databricks)

```python
# databricks_client.py: _execute_query()

def _execute_query(self, sql: str):
    # 1. Submit query (async)
    response = requests.post(
        "https://xxx.azuredatabricks.net/api/2.0/statements",
        json={"statement": sql, "warehouse_id": "abc123"},
        headers={"Authorization": f"Bearer {token}"}
    )
    statement_id = response.json()["statement_id"]
    
    # 2. Poll for completion
    start = time.time()
    while True:
        response = requests.get(
            f"https://xxx.azuredatabricks.net/api/2.0/statements/{statement_id}",
            headers=headers
        )
        status = response.json()["status"]
        
        if status == "SUCCEEDED":
            return response.json()
        elif status == "FAILED":
            raise Exception("Query failed")
        elif time.time() - start > 60:
            raise TimeoutError("Timeout")
        
        time.sleep(0.5)  # Poll every 500ms
```

---

### Example 9: Using with Analysis Functions

```python
# analysis.py: get_coverage()
# No changes needed!

def get_coverage(conn, hurricane_id: str = None):
    """Works with DuckDB or Databricks"""
    query = """
        SELECT 
            s.hurricane_id,
            s.admin1,
            s.severity_index,
            ...
        FROM severity s
        LEFT JOIN projects p ON ...
        WHERE s.hurricane_id = ?
    """
    
    # This works regardless of backend
    results = conn.execute(query, [hurricane_id]).fetchall()
    
    coverage_data = []
    for row in results:
        coverage_data.append({
            "hurricane_id": row[0],
            ...
        })
    
    return coverage_data
```

---

### Example 10: Switching Between Modes

**Mode 1: Local Development**
```bash
$ unset DATABRICKS_SERVER_HOSTNAME
$ unset DATABRICKS_HTTP_PATH
$ unset DATABRICKS_PAT
$ uvicorn main:app --reload

# Logs: "Using local DuckDB backend"
# Uses: In-memory DuckDB
```

**Mode 2: Production**
```bash
$ export DATABRICKS_SERVER_HOSTNAME=adb-xxx.azuredatabricks.net
$ export DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/xxx
$ export DATABRICKS_PAT=dapixxx...
$ uvicorn main:app --reload

# Logs: "Using Databricks SQL Warehouse backend"
# Uses: Cloud Databricks
```

**No code changes**, just environment variables!

---

### Example 11: Testing Both Modes

```bash
# Use pytest to test with mock Databricks

import unittest.mock as mock
from data_loader import initialize_database

# Test DuckDB mode
def test_duckdb_mode():
    # Unset Databricks vars
    with mock.patch.dict('os.environ', {}, clear=True):
        db = initialize_database()
        assert db.__class__.__name__ == 'DuckDBPyConnection'

# Test Databricks mode
def test_databricks_mode():
    with mock.patch.dict('os.environ', {
        'DATABRICKS_SERVER_HOSTNAME': 'test',
        'DATABRICKS_HTTP_PATH': '/test',
        'DATABRICKS_PAT': 'test'
    }):
        db = initialize_database()
        assert db.__class__.__name__ == 'DatabricksConnection'
```

---

### Example 12: Production Performance Tuning

```python
# databricks_client.py: Constructor

conn = DatabricksConnection(
    server_hostname="...",
    http_path="...",
    personal_access_token="...",
    
    # Tuning options
    warehouse_timeout_seconds=120,  # Increase for large queries
    catalog="hive_metastore",
    schema="stormline"
)

# SQL Warehouse also configurable in Databricks UI:
# - Number of clusters (auto-scaling)
# - Spot instances (cost savings)
# - Scaling thresholds
```

---

## Key Takeaway

The integration swaps only the storage layer:

```
Frontend (unchanged)
    ↓
FastAPI endpoints (unchanged)
    ↓
Analysis logic (unchanged)
    ↓
Query execution (CHANGED: DuckDB ↔ Databricks)
    ↓
Database result (both return same format)
```

**Code change complexity**: Minimal (wrapper + auto-detect)  
**Operational impact**: Choose at startup  
**Rollback time**: 2 seconds (just remove env vars)
