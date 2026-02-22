"""
Standalone module: use Databricks Vector Search to fetch data about each hurricane
listed in hurricanes.json. Not imported or used elsewhere.

Requires:
  - hurricanes.json (e.g. in sample_data/)
  - Databricks workspace with a Vector Search endpoint and index containing hurricane data
  - Env: DATABRICKS_SERVER_HOSTNAME, DATABRICKS_PERSONAL_ACCESS_TOKEN,
    DATABRICKS_VECTOR_SEARCH_ENDPOINT_NAME, DATABRICKS_VECTOR_SEARCH_INDEX_NAME
  - Optional (for text queries): embedding model endpoint to convert hurricane text to vector
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests


def _hurricanes_json_path() -> Path:
    """Path to hurricanes.json (same dir as this file, sample_data)."""
    base = Path(__file__).resolve().parent
    for sub in ("sample_data", "response_plan_prediction/data", "data"):
        p = base / sub / "hurricanes.json"
        if p.exists():
            return p
    return base / "sample_data" / "hurricanes.json"


def load_hurricanes_from_json() -> List[Dict[str, Any]]:
    """Load hurricane records from hurricanes.json."""
    path = _hurricanes_json_path()
    if not path.exists():
        return []
    with open(path, "r") as f:
        return json.load(f)


def _get_embedding_for_text(
    server_hostname: str,
    personal_access_token: str,
    text: str,
    embedding_endpoint_name: Optional[str] = None,
) -> Optional[List[float]]:
    """
    Get embedding vector for text via Databricks (e.g. Foundation Model or embedding endpoint).
    If embedding_endpoint_name is not set, returns None (caller may use a fixed or random vector for testing).
    """
    if not embedding_endpoint_name:
        return None
    url = f"https://{server_hostname}/serving-endpoints/{embedding_endpoint_name}/invocations"
    headers = {
        "Authorization": f"Bearer {personal_access_token}",
        "Content-Type": "application/json",
    }
    payload = {"inputs": [text]}
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        # Common shapes: {"predictions": [[...]]} or {"embeddings": [[...]]}
        if "predictions" in data and data["predictions"]:
            return data["predictions"][0]
        if "embeddings" in data and data["embeddings"]:
            return data["embeddings"][0]
        return None
    except Exception:
        return None


def query_vector_search_index(
    server_hostname: str,
    personal_access_token: str,
    endpoint_name: str,
    index_name: str,
    query_vector: List[float],
    num_results: int = 40,
    columns: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Query Databricks Vector Search index with a query vector.
    Returns list of results (each with primary key and optional columns).
    """
    api_base = f"https://{server_hostname}/api/2.0"
    url = f"{api_base}/vector-search/endpoints/{endpoint_name}/indexes/{index_name}/query"
    headers = {
        "Authorization": f"Bearer {personal_access_token}",
        "Content-Type": "application/json",
    }
    body = {
        "query_vector": query_vector,
        "num_results": num_results,
    }
    if columns:
        body["columns"] = columns
    try:
        resp = requests.post(url, json=body, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        # Response shape: { "result": { "result_rows": [ { "primary_key": ..., "score": ..., ... } ] } }
        result = data.get("result", {})
        rows = result.get("result_rows", [])
        return rows if isinstance(rows, list) else []
    except Exception as e:
        return []


def hurricane_to_search_text(h: Dict[str, Any]) -> str:
    """Build a single searchable text for a hurricane (for embedding)."""
    name = h.get("name", "")
    year = h.get("year", "")
    countries = ", ".join(h.get("affected_countries", []))
    cat = h.get("max_category", "")
    pop = h.get("estimated_population_affected", "")
    return f"{name} {year} {countries} Category {cat} population affected {pop}".strip()


def fetch_hurricane_data_via_vector_search(
    num_results_per_query: int = 40,
    embedding_endpoint_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    For each hurricane in hurricanes.json, use Databricks Vector Search to fetch
    data about that hurricane. Returns a list of per-hurricane results from the index.
    """
    hurricanes = load_hurricanes_from_json()
    if not hurricanes:
        return []

    server = os.environ.get("DATABRICKS_SERVER_HOSTNAME", "").strip()
    token = os.environ.get("DATABRICKS_PERSONAL_ACCESS_TOKEN", "").strip()
    endpoint = os.environ.get("DATABRICKS_VECTOR_SEARCH_ENDPOINT_NAME", "").strip()
    index = os.environ.get("DATABRICKS_VECTOR_SEARCH_INDEX_NAME", "").strip()

    if not server or not token or not endpoint or not index:
        return []

    all_fetched: List[Dict[str, Any]] = []
    for h in hurricanes:
        search_text = hurricane_to_search_text(h)
        query_vector = _get_embedding_for_text(
            server, token, search_text, embedding_endpoint_name
        )
        if query_vector is None:
            # No embedding endpoint: use a placeholder zero vector (index must accept same dimension)
            # In production you would require an embedding endpoint or precomputed vectors.
            continue
        rows = query_vector_search_index(
            server_hostname=server,
            personal_access_token=token,
            endpoint_name=endpoint,
            index_name=index,
            query_vector=query_vector,
            num_results=num_results_per_query,
            columns=None,
        )
        all_fetched.append({
            "hurricane_id": h.get("id"),
            "hurricane_name": h.get("name"),
            "hurricane_year": h.get("year"),
            "search_text": search_text,
            "vector_search_results": rows,
        })
    return all_fetched


def main() -> None:
    """Load hurricanes.json and fetch data for each via Databricks Vector Search."""
    results = fetch_hurricane_data_via_vector_search(
        num_results_per_query=40,
        embedding_endpoint_name=os.environ.get("DATABRICKS_EMBEDDING_ENDPOINT_NAME"),
    )
    for r in results:
        print(
            r["hurricane_id"],
            r["hurricane_name"],
            r["hurricane_year"],
            "->",
            len(r["vector_search_results"]),
            "results",
        )
    print("Total hurricanes processed:", len(results))


if __name__ == "__main__":
    main()
