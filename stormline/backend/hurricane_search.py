"""
Databricks Vector Search for hurricane matching from natural-language user input.

When configured (see env vars below), `/hurricanes/match` uses semantic similarity
against a Vector Search index; otherwise callers fall back to rule-based scoring.

Required env (Vector Search):
  DATABRICKS_SERVER_HOSTNAME
  DATABRICKS_PAT  (or DATABRICKS_PERSONAL_ACCESS_TOKEN)
  DATABRICKS_VECTOR_SEARCH_ENDPOINT_NAME
  DATABRICKS_VECTOR_SEARCH_INDEX_NAME

Optional:
  DATABRICKS_EMBEDDING_ENDPOINT_NAME — used if the index does not accept query_text
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

try:
    from dotenv import load_dotenv

    _env_path = Path(__file__).resolve().parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    pass


def _databricks_token() -> str:
    return (
        os.environ.get("DATABRICKS_PAT", "").strip()
        or os.environ.get("DATABRICKS_PERSONAL_ACCESS_TOKEN", "").strip()
    )


_PLACEHOLDER_MARKERS = (
    "xxxx",
    "your_",
    "your-",
    "example",
    "changeme",
    "replace_me",
    "catalog.schema.hurricanes_index",
)


def _env_flag_enabled(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


def _looks_like_placeholder(value: str) -> bool:
    lower = value.lower()
    return any(marker in lower for marker in _PLACEHOLDER_MARKERS) or value.endswith("...")


def is_vector_search_configured() -> bool:
    """
    True when Vector Search is explicitly enabled and credentials look real.

    `.env` may list Databricks vars for documentation; keep
    DATABRICKS_VECTOR_SEARCH_ENABLED=false for local rule-based matching.
    """
    if not _env_flag_enabled("DATABRICKS_VECTOR_SEARCH_ENABLED"):
        return False

    hostname = os.environ.get("DATABRICKS_SERVER_HOSTNAME", "").strip()
    token = _databricks_token()
    endpoint = os.environ.get("DATABRICKS_VECTOR_SEARCH_ENDPOINT_NAME", "").strip()
    index = os.environ.get("DATABRICKS_VECTOR_SEARCH_INDEX_NAME", "").strip()

    if not (hostname and token and endpoint and index):
        return False
    if any(_looks_like_placeholder(v) for v in (hostname, token, endpoint, index)):
        return False
    return True


def build_user_search_query(
    region: str,
    category: int,
    direction: Optional[str] = None,
    extra_details: Optional[str] = None,
) -> str:
    """Combine structured + free-text user input into one embedding/query string."""
    parts: List[str] = [f"Category {category} hurricane"]
    region_clean = (region or "").strip()
    if region_clean:
        parts.append(f"affecting {region_clean}")
    if direction and direction.strip():
        parts.append(f"moving {direction.strip().lower()}")
    if extra_details and extra_details.strip():
        parts.append(extra_details.strip())
    return ". ".join(parts)


def hurricane_to_search_text(h: Dict[str, Any]) -> str:
    """Build searchable text for a hurricane record (indexing / debugging)."""
    name = h.get("name", "")
    year = h.get("year", "")
    countries = ", ".join(h.get("affected_countries", []))
    cat = h.get("max_category", "")
    pop = h.get("estimated_population_affected", "")
    return f"{name} {year} {countries} Category {cat} population affected {pop}".strip()


def _get_embedding_for_text(
    server_hostname: str,
    personal_access_token: str,
    text: str,
    embedding_endpoint_name: Optional[str] = None,
) -> Optional[List[float]]:
    """Embed text via a Databricks Model Serving endpoint."""
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
        if "predictions" in data and data["predictions"]:
            return data["predictions"][0]
        if "embeddings" in data and data["embeddings"]:
            return data["embeddings"][0]
        if "data" in data and isinstance(data["data"], list) and data["data"]:
            row = data["data"][0]
            if isinstance(row, dict) and "embedding" in row:
                return row["embedding"]
        return None
    except Exception:
        return None


def _vector_search_url(server_hostname: str, endpoint_name: str, index_name: str) -> str:
    api_base = f"https://{server_hostname}/api/2.0"
    return f"{api_base}/vector-search/endpoints/{endpoint_name}/indexes/{index_name}/query"


def query_vector_search_index(
    server_hostname: str,
    personal_access_token: str,
    endpoint_name: str,
    index_name: str,
    *,
    query_text: Optional[str] = None,
    query_vector: Optional[List[float]] = None,
    num_results: int = 10,
    columns: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Query a Databricks Vector Search index.
    Prefers query_text (indexes with an embedding model); falls back to query_vector.
    """
    if not query_text and not query_vector:
        return []

    url = _vector_search_url(server_hostname, endpoint_name, index_name)
    headers = {
        "Authorization": f"Bearer {personal_access_token}",
        "Content-Type": "application/json",
    }
    body: Dict[str, Any] = {"num_results": num_results}
    if query_text:
        body["query_text"] = query_text
    if query_vector:
        body["query_vector"] = query_vector
    if columns:
        body["columns"] = columns

    try:
        resp = requests.post(url, json=body, headers=headers, timeout=60)
        if resp.status_code >= 400 and query_text and query_vector:
            # Index may not support query_text — retry with vector only
            body = {"num_results": num_results, "query_vector": query_vector}
            if columns:
                body["columns"] = columns
            resp = requests.post(url, json=body, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        result = data.get("result", data)
        rows = result.get("result_rows", result.get("data_array", []))
        return rows if isinstance(rows, list) else []
    except Exception:
        return []


def _extract_hurricane_id(row: Dict[str, Any]) -> Optional[str]:
    """Resolve hurricane id from a vector-search result row."""
    for key in ("id", "hurricane_id", "primary_key", "doc_id"):
        val = row.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    # Some indexes nest fields under a document key
    doc = row.get("document") or row.get("row") or row.get("fields")
    if isinstance(doc, dict):
        return _extract_hurricane_id(doc)
    return None


def _extract_score(row: Dict[str, Any]) -> float:
    for key in ("score", "similarity", "distance"):
        if key in row and row[key] is not None:
            try:
                return float(row[key])
            except (TypeError, ValueError):
                pass
    return 0.0


def search_hurricanes_by_user_query(
    query_text: str,
    num_results: int = 10,
    embedding_endpoint_name: Optional[str] = None,
) -> List[Tuple[str, float, Dict[str, Any]]]:
    """
    Run Vector Search for a user query.

    Returns list of (hurricane_id, score, raw_row) sorted by relevance (highest first).
    """
    if not is_vector_search_configured():
        return []

    server = os.environ.get("DATABRICKS_SERVER_HOSTNAME", "").strip()
    token = _databricks_token()
    endpoint = os.environ.get("DATABRICKS_VECTOR_SEARCH_ENDPOINT_NAME", "").strip()
    index = os.environ.get("DATABRICKS_VECTOR_SEARCH_INDEX_NAME", "").strip()
    embed_endpoint = embedding_endpoint_name or os.environ.get(
        "DATABRICKS_EMBEDDING_ENDPOINT_NAME", ""
    ).strip() or None

    query_vector: Optional[List[float]] = None
    if embed_endpoint:
        query_vector = _get_embedding_for_text(server, token, query_text, embed_endpoint)

    rows = query_vector_search_index(
        server_hostname=server,
        personal_access_token=token,
        endpoint_name=endpoint,
        index_name=index,
        query_text=query_text,
        query_vector=query_vector,
        num_results=num_results,
        columns=["id", "hurricane_id", "name", "year", "max_category", "affected_countries"],
    )

    matches: List[Tuple[str, float, Dict[str, Any]]] = []
    seen: set[str] = set()
    for row in rows:
        hid = _extract_hurricane_id(row)
        if not hid or hid in seen:
            continue
        seen.add(hid)
        matches.append((hid, _extract_score(row), row))

    matches.sort(key=lambda x: x[1], reverse=True)
    return matches


def load_hurricanes_from_json() -> List[Dict[str, Any]]:
    """Load hurricane records from sample_data/hurricanes.json."""
    base = Path(__file__).resolve().parent
    for sub in ("sample_data", "response_plan_prediction/data", "data"):
        path = base / sub / "hurricanes.json"
        if path.exists():
            with open(path, "r") as f:
                return json.load(f)
    return []
