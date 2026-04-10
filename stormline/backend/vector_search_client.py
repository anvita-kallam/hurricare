"""
Databricks Vector Search client for hurricane semantic search.
Used by main.py to power the /hurricanes/match endpoint.
Falls back gracefully if Vector Search is not configured.
"""

import json
import os
from typing import List

import requests


def search_similar_hurricanes(query_text: str, num_results: int = 5) -> list[dict]:
    """
    Search for similar hurricanes using Databricks Vector Search.
    Returns list of hurricane dicts matching the hurricanes.json schema.
    Falls back to empty list if Vector Search is not configured.
    """
    hostname = os.environ.get("DATABRICKS_SERVER_HOSTNAME", "").strip()
    pat = os.environ.get("DATABRICKS_PAT", "").strip()
    index_name = os.environ.get("DATABRICKS_VECTOR_SEARCH_INDEX_NAME", "").strip()

    if not hostname or not pat or not index_name:
        return []

    url = f"https://{hostname}/api/2.0/vector-search/indexes/{index_name}/query"
    headers = {
        "Authorization": f"Bearer {pat}",
        "Content-Type": "application/json",
    }
    body = {
        "num_results": num_results,
        "query_text": query_text,
        "columns": [
            "id", "name", "year", "max_category",
            "affected_countries", "estimated_population_affected", "track",
        ],
    }

    try:
        resp = requests.post(url, json=body, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []

    columns = [c["name"] for c in data.get("manifest", {}).get("columns", [])]
    rows = data.get("result", {}).get("data_array", [])

    hurricanes = []
    for row in rows:
        row_dict = dict(zip(columns, row))

        # Parse JSON string fields back to native types
        track = row_dict.get("track", "[]")
        if isinstance(track, str):
            try:
                track = json.loads(track)
            except (json.JSONDecodeError, TypeError):
                track = []

        countries = row_dict.get("affected_countries", "[]")
        if isinstance(countries, str):
            try:
                countries = json.loads(countries)
            except (json.JSONDecodeError, TypeError):
                countries = []

        year = row_dict.get("year", 0)
        max_cat = row_dict.get("max_category", 0)
        pop = row_dict.get("estimated_population_affected", 0)

        hurricanes.append({
            "id": row_dict.get("id", ""),
            "name": row_dict.get("name", ""),
            "year": int(float(year)) if year else 0,
            "max_category": int(float(max_cat)) if max_cat else 0,
            "track": track,
            "affected_countries": countries,
            "estimated_population_affected": int(float(pop)) if pop else 0,
        })

    return hurricanes
