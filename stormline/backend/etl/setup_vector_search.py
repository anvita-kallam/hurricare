"""
Set up Databricks Vector Search for hurricane semantic search.

Creates a search corpus table, provisions a Vector Search endpoint,
creates a Delta Sync index with auto-embedding, and runs a test query.

Run: python3 stormline/backend/etl/setup_vector_search.py
"""

import functools
import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

# Force unbuffered output so progress is visible in real time
print = functools.partial(print, flush=True)

# Load credentials
BACKEND_DIR = Path(__file__).parent.parent
load_dotenv(BACKEND_DIR / ".env")

HOSTNAME = os.environ["DATABRICKS_SERVER_HOSTNAME"]
HTTP_PATH = os.environ["DATABRICKS_HTTP_PATH"]
PAT = os.environ["DATABRICKS_PAT"]

API_BASE = f"https://{HOSTNAME}/api/2.0"
HEADERS = {
    "Authorization": f"Bearer {PAT}",
    "Content-Type": "application/json",
}

WAREHOUSE_ID = HTTP_PATH.split("/")[-1]

# Our data currently lives in workspace.stormline (hive_metastore is disabled).
# Vector Search Delta Sync requires Unity Catalog tables.
CATALOG = "workspace"
SCHEMA = "stormline"
CORPUS_TABLE = f"{CATALOG}.{SCHEMA}.hurricane_search_corpus"
VS_ENDPOINT_NAME = "hurricare-vs-endpoint"
VS_INDEX_NAME = f"{CATALOG}.{SCHEMA}.hurricane_search_index"

# Embedding model — try bge-large first, fall back to gte-large
EMBEDDING_MODELS = ["databricks-bge-large-en", "databricks-gte-large-en"]


# --- Helpers ---

def sql_execute(sql: str) -> dict:
    """Execute SQL via the Statement Execution API and poll for results."""
    url = f"{API_BASE}/sql/statements"
    payload = {"statement": sql, "warehouse_id": WAREHOUSE_ID, "wait_timeout": "30s"}

    resp = requests.post(url, json=payload, headers=HEADERS, timeout=60)
    if not resp.ok:
        print(f"  SQL API error: {resp.status_code}")
        print(f"  {resp.text}")
        resp.raise_for_status()

    data = resp.json()
    stmt_id = data["statement_id"]
    state = data.get("status", {}).get("state", "PENDING")

    if state == "SUCCEEDED":
        return data

    get_url = f"{API_BASE}/sql/statements/{stmt_id}"
    deadline = time.time() + 180

    while True:
        resp = requests.get(get_url, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
        state = data.get("status", {}).get("state", "PENDING")

        if state == "SUCCEEDED":
            return data
        if state == "FAILED":
            err = data.get("status", {}).get("error", {})
            raise RuntimeError(f"SQL failed: {err.get('message', data)}")
        if state in ("CANCELED", "CLOSED"):
            raise RuntimeError(f"SQL was {state}")
        if time.time() > deadline:
            raise TimeoutError("SQL execution timed out after 120s")

        time.sleep(1)


def api_post(path: str, body: dict) -> requests.Response:
    """POST to a Databricks REST API path. Returns the response (caller checks status)."""
    url = f"{API_BASE}{path}"
    return requests.post(url, json=body, headers=HEADERS)


def api_get(path: str) -> requests.Response:
    """GET from a Databricks REST API path."""
    url = f"{API_BASE}{path}"
    return requests.get(url, headers=HEADERS)


def poll_with_backoff(check_fn, description: str, max_wait: int = 900):
    """
    Poll check_fn() with exponential backoff until it returns a truthy value.
    check_fn should return (done: bool, status_msg: str).
    """
    start = time.time()
    interval = 5

    while True:
        done, msg = check_fn()
        elapsed = int(time.time() - start)
        print(f"  [{elapsed}s] {description}: {msg}")

        if done:
            return
        if time.time() - start > max_wait:
            raise TimeoutError(f"{description} did not complete within {max_wait}s")

        time.sleep(interval)
        interval = min(interval * 1.5, 30)


# ============================================================
# STEP 2: Create and populate the search corpus table
# ============================================================

def step2_create_corpus():
    print("\n--- Step 2: Create hurricane_search_corpus table ---")

    print("  Dropping existing table if present...")
    sql_execute(f"DROP TABLE IF EXISTS {CORPUS_TABLE}")

    print("  Creating table...")
    sql_execute(f"""
        CREATE TABLE {CORPUS_TABLE} (
            id STRING,
            search_text STRING,
            name STRING,
            year INT,
            max_category INT,
            affected_countries STRING,
            estimated_population_affected INT,
            track STRING
        )
        USING DELTA
    """)

    # Enable Change Data Feed — required for Delta Sync indexes
    print("  Enabling Change Data Feed on corpus table...")
    sql_execute(f"""
        ALTER TABLE {CORPUS_TABLE}
        SET TBLPROPERTIES (delta.enableChangeDataFeed = true)
    """)

    print("  Populating from hurricanes table...")
    source = f"{CATALOG}.{SCHEMA}.hurricanes"
    sql_execute(f"""
        INSERT INTO {CORPUS_TABLE}
        SELECT
            id,
            CONCAT(
                'Hurricane ', name, ' ', CAST(year AS STRING),
                ' Category ', CAST(max_category AS STRING),
                ' affecting ', REPLACE(REPLACE(REPLACE(affected_countries, '["', ''), '"]', ''), '","', ', '),
                ' with ', CAST(estimated_population_affected AS STRING), ' people affected'
            ) AS search_text,
            name,
            year,
            max_category,
            affected_countries,
            estimated_population_affected,
            track
        FROM {source}
    """)

    result = sql_execute(f"SELECT COUNT(*) AS cnt FROM {CORPUS_TABLE}")
    count = result.get("result", {}).get("data_array", [[0]])[0][0]
    print(f"  Corpus table populated with {count} rows")
    return int(count)


# ============================================================
# STEP 3: Create Vector Search endpoint
# ============================================================

def step3_create_endpoint():
    print(f"\n--- Step 3: Create Vector Search endpoint '{VS_ENDPOINT_NAME}' ---")

    # Check if it already exists
    resp = api_get(f"/vector-search/endpoints/{VS_ENDPOINT_NAME}")
    if resp.ok:
        state = resp.json().get("endpoint_status", {}).get("state", "UNKNOWN")
        print(f"  Endpoint already exists (state: {state})")
        if state == "ONLINE":
            return
        # If provisioning, just wait
    else:
        # Create it
        print("  Creating endpoint...")
        resp = api_post("/vector-search/endpoints", {
            "name": VS_ENDPOINT_NAME,
            "endpoint_type": "STANDARD",
        })
        if not resp.ok:
            print(f"  Error {resp.status_code}: {resp.text}")
            resp.raise_for_status()
        print(f"  Endpoint creation initiated")

    # Poll until ONLINE
    def check():
        r = api_get(f"/vector-search/endpoints/{VS_ENDPOINT_NAME}")
        if not r.ok:
            return False, f"HTTP {r.status_code}"
        state = r.json().get("endpoint_status", {}).get("state", "UNKNOWN")
        return state == "ONLINE", state

    poll_with_backoff(check, "Endpoint provisioning", max_wait=900)


# ============================================================
# STEP 4: Create Vector Search index (Delta Sync)
# ============================================================

def step4_create_index():
    print(f"\n--- Step 4: Create Vector Search index ---")

    # Check if index already exists
    resp = api_get(f"/vector-search/indexes/{VS_INDEX_NAME}")
    if resp.ok:
        status = resp.json().get("status", {})
        print(f"  Index already exists: {status}")
        return

    # Try each embedding model
    last_error = None
    for model in EMBEDDING_MODELS:
        print(f"  Attempting index creation with embedding model: {model}")

        body = {
            "name": VS_INDEX_NAME,
            "endpoint_name": VS_ENDPOINT_NAME,
            "primary_key": "id",
            "index_type": "DELTA_SYNC",
            "delta_sync_index_spec": {
                "source_table": CORPUS_TABLE,
                "pipeline_type": "TRIGGERED",
                "embedding_source_columns": [
                    {
                        "name": "search_text",
                        "embedding_model_endpoint_name": model,
                    }
                ],
            },
        }

        resp = api_post("/vector-search/indexes", body)

        if resp.ok:
            print(f"  Index creation initiated with model '{model}'")
            return
        else:
            last_error = resp.text
            print(f"  Failed with {model}: {resp.status_code} — {resp.text}")

            # If it's not a model-related error, don't retry with another model
            if resp.status_code not in (400, 404):
                break

    print(f"\n  All embedding models failed. Last error:\n  {last_error}")
    raise RuntimeError("Could not create vector search index")


# ============================================================
# STEP 5: Trigger initial sync
# ============================================================

def step5_trigger_sync():
    print(f"\n--- Step 5: Trigger initial sync ---")

    resp = api_post(f"/vector-search/indexes/{VS_INDEX_NAME}/sync", {})
    if resp.ok:
        print("  Sync triggered")
    elif resp.status_code == 409:
        # Sync already in progress or auto-triggered
        print(f"  Sync already in progress: {resp.text}")
    else:
        print(f"  Warning: sync trigger returned {resp.status_code}: {resp.text}")
        print("  (Index may auto-sync after creation — continuing to poll)")


# ============================================================
# STEP 6: Poll until index is ready
# ============================================================

def step6_wait_for_ready():
    print(f"\n--- Step 6: Wait for index to be ready ---")

    def check():
        r = api_get(f"/vector-search/indexes/{VS_INDEX_NAME}")
        if not r.ok:
            return False, f"HTTP {r.status_code}"
        data = r.json()
        status = data.get("status", {})
        is_ready = status.get("ready", False)
        indexed_rows = status.get("indexed_row_count", 0)
        num_rows = status.get("num_rows", indexed_rows)
        row_count = indexed_rows or num_rows
        msg = f"ready={is_ready}, rows={row_count}"

        detailed = status.get("message", "")
        if detailed:
            msg += f" — {detailed}"

        return (is_ready and row_count > 0), msg

    poll_with_backoff(check, "Index sync", max_wait=900)


# ============================================================
# STEP 7: Test query
# ============================================================

def step7_test_query():
    print(f"\n--- Step 7: Test query ---")

    query_text = "Category 5 hurricane hitting the Caribbean in 2017"
    print(f"  Query: \"{query_text}\"")

    body = {
        "num_results": 5,
        "query_text": query_text,
        "columns": ["id", "name", "year", "max_category", "affected_countries"],
    }

    resp = api_post(f"/vector-search/indexes/{VS_INDEX_NAME}/query", body)
    if not resp.ok:
        print(f"  Query failed: {resp.status_code}")
        print(f"  {resp.text}")
        return False

    data = resp.json()
    columns = data.get("manifest", {}).get("columns", [])
    col_names = [c["name"] for c in columns]
    rows = data.get("result", {}).get("data_array", [])

    print(f"\n  Results ({len(rows)} matches):")
    print(f"  {'Rank':<6} {'ID':<25} {'Name':<30} {'Year':<6} {'Cat':<5} {'Countries'}")
    print(f"  {'-'*5:<6} {'-'*24:<25} {'-'*29:<30} {'-'*4:<6} {'-'*3:<5} {'-'*30}")

    for i, row in enumerate(rows):
        row_dict = dict(zip(col_names, row))
        # Score is typically the last column or in a separate field
        score_col = [c for c in col_names if "score" in c.lower()]
        score = row_dict.get(score_col[0], "") if score_col else ""
        print(f"  {i+1:<6} {row_dict.get('id', ''):<25} {row_dict.get('name', ''):<30} "
              f"{row_dict.get('year', ''):<6} {row_dict.get('max_category', ''):<5} "
              f"{row_dict.get('affected_countries', '')[:40]}")

    return True


# ============================================================
# STEP 8: Save config to .env
# ============================================================

def step8_update_env():
    print(f"\n--- Step 8: Update .env ---")

    env_path = BACKEND_DIR / ".env"
    env_content = env_path.read_text()

    additions = {}
    if "DATABRICKS_VECTOR_SEARCH_ENDPOINT_NAME" not in env_content:
        additions["DATABRICKS_VECTOR_SEARCH_ENDPOINT_NAME"] = VS_ENDPOINT_NAME
    if "DATABRICKS_VECTOR_SEARCH_INDEX_NAME" not in env_content:
        additions["DATABRICKS_VECTOR_SEARCH_INDEX_NAME"] = VS_INDEX_NAME

    if additions:
        with open(env_path, "a") as f:
            f.write("\n")
            for key, val in additions.items():
                f.write(f"{key}={val}\n")
                print(f"  Added {key}={val}")
    else:
        print("  .env already has Vector Search config")


# ============================================================
# Main
# ============================================================

def main():
    print("=" * 60)
    print("DATABRICKS VECTOR SEARCH SETUP")
    print("=" * 60)
    print(f"  Hostname:  {HOSTNAME}")
    print(f"  Catalog:   {CATALOG}")
    print(f"  Schema:    {SCHEMA}")
    print(f"  Endpoint:  {VS_ENDPOINT_NAME}")
    print(f"  Index:     {VS_INDEX_NAME}")

    step2_create_corpus()
    step3_create_endpoint()
    step4_create_index()
    step5_trigger_sync()
    step6_wait_for_ready()
    query_ok = step7_test_query()
    step8_update_env()

    print("\n" + "=" * 60)
    print("DONE")
    print("=" * 60)
    if query_ok:
        print("  Vector Search is live and returning results!")
    else:
        print("  Vector Search is set up but test query had issues.")
        print("  The index may need more time — retry the query manually.")


if __name__ == "__main__":
    main()
