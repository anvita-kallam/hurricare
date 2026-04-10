"""
Fetch humanitarian funding data for hurricanes from OCHA FTS API.
Produces projects CSV, severity CSV, and filtered hurricanes JSON.
"""

import csv
import json
import os
import random
import urllib.request
import urllib.error
from base64 import b64encode
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# --- Constants ---

ETL_DIR = Path(__file__).parent

COUNTRY_FTS_IDS = {
    "United States": 236,
    "Cuba": 55,
    "Mexico": 141,
    "Haiti": 94,
    "Jamaica": 112,
    "Dominican Republic": 62,
    "Puerto Rico": 180,
    "Bahamas": 16,
    "Honduras": 99,
    "Nicaragua": 157,
    "Guatemala": 91,
    "Canada": 39,
    "Bermuda": 23,
    "Belize": 22,
}

COUNTRY_ISO3 = {
    "United States": "USA",
    "Cuba": "CUB",
    "Mexico": "MEX",
    "Haiti": "HTI",
    "Jamaica": "JAM",
    "Dominican Republic": "DOM",
    "Puerto Rico": "PRI",
    "Bahamas": "BHS",
    "Honduras": "HND",
    "Nicaragua": "NIC",
    "Guatemala": "GTM",
    "Canada": "CAN",
    "Bermuda": "BMU",
    "Belize": "BLZ",
}

# Map FTS cluster names to our standard cluster names
CLUSTER_MAP = {
    "education": "Education",
    "water sanitation hygiene": "WASH",
    "water, sanitation and hygiene": "WASH",
    "wash": "WASH",
    "health": "Health",
    "protection": "Protection",
    "shelter": "Shelter",
    "emergency shelter": "Shelter",
    "camp coordination / camp management": "Shelter",
    "emergency shelter and nfi": "Shelter",
    "shelter/nfi": "Shelter",
    "food security": "Food Security",
    "food": "Food Security",
    "food security and agriculture": "Food Security",
    "agriculture": "Food Security",
    "livelihoods": "Livelihoods",
    "early recovery": "Livelihoods",
    "early recovery and livelihoods": "Livelihoods",
    "energy": "Energy",
    "nutrition": "Health",
}

VALID_CLUSTERS = ["Education", "WASH", "Health", "Protection", "Shelter",
                  "Food Security", "Livelihoods", "Energy"]

# Typical humanitarian cluster distribution weights (when FTS only has "Not specified")
CLUSTER_WEIGHTS = {
    "Health": 0.20,
    "Food Security": 0.20,
    "Shelter": 0.18,
    "WASH": 0.15,
    "Protection": 0.10,
    "Education": 0.08,
    "Livelihoods": 0.07,
    "Energy": 0.02,
}

COST_PER_PERSON = 500

IMPLEMENTING_PARTNERS = [
    "UNICEF", "Red Cross", "Oxfam", "Save the Children",
    "World Vision", "UNDP", "WHO", "WFP", "IOM", "UNHCR",
]


# --- FTS API ---

def fts_auth_header() -> Optional[str]:
    """Build Basic Auth header if FTS credentials are set."""
    client_id = os.environ.get("FTS_CLIENT_ID")
    client_pw = os.environ.get("FTS_CLIENT_PASSWORD")
    if client_id and client_pw:
        token = b64encode(f"{client_id}:{client_pw}".encode()).decode()
        return f"Basic {token}"
    return None


def _fts_request(url: str) -> Optional[Dict]:
    """Make an authenticated FTS API request."""
    headers = {"Accept": "application/json", "User-Agent": "stormline-etl/1.0"}
    auth = fts_auth_header()
    if auth:
        headers["Authorization"] = auth
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return None


def fetch_fts_cluster_totals(year: int, location_id: int) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Fetch funding grouped by cluster from FTS.
    Returns (total_funding, list of {cluster_raw, amount}).
    """
    url = (
        f"https://api.hpc.tools/v1/public/fts/flow"
        f"?year={year}&locationId={location_id}&groupby=cluster"
    )
    data = _fts_request(url)
    if not data:
        return 0, []

    report3 = (data.get("data") or {}).get("report3") or {}
    funding_totals = report3.get("fundingTotals") or {}
    objects = funding_totals.get("objects") or []

    total = 0
    clusters = []
    for group in objects:
        if group.get("type") != "Cluster":
            continue
        for item in group.get("singleFundingObjects", []):
            name = item.get("name", "").strip()
            amount = item.get("totalFunding", 0) or 0
            if amount and name:
                total += amount
                clusters.append({"cluster_raw": name, "amount": float(amount)})

    return total, clusters


def fetch_fts_flow_sample(year: int, location_id: int, limit: int = 20) -> List[Dict]:
    """Fetch a sample of individual flows to extract org names and pooled-fund flags."""
    url = (
        f"https://api.hpc.tools/v1/public/fts/flow"
        f"?year={year}&locationId={location_id}&limit={limit}"
    )
    data = _fts_request(url)
    if not data:
        return []
    return (data.get("data") or {}).get("flows") or []


def extract_orgs_and_pooled(flows: List[Dict]) -> Tuple[List[str], bool]:
    """Extract org names and whether CERF/CBPF appears in flows."""
    orgs = []
    has_pooled = False
    for flow in flows:
        for obj in flow.get("destinationObjects", []):
            if obj.get("type") == "Organization":
                name = obj.get("name", "")
                if name and name not in orgs:
                    orgs.append(name)
        blob = json.dumps(flow).upper()
        if "CERF" in blob or "CBPF" in blob:
            has_pooled = True
    return orgs, has_pooled


# --- Cluster mapping & distribution ---

def map_cluster(raw_name: str) -> Optional[str]:
    """Map a raw FTS cluster name to our standard cluster name."""
    key = raw_name.lower().strip()
    if key in CLUSTER_MAP:
        return CLUSTER_MAP[key]
    for pattern, mapped in CLUSTER_MAP.items():
        if pattern in key or key in pattern:
            return mapped
    for vc in VALID_CLUSTERS:
        if vc.lower() in key or key in vc.lower():
            return vc
    return None


def distribute_funding(total: float, cluster_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Take FTS cluster totals and produce standard cluster rows.
    If all/most funding is 'Not specified', distribute across clusters using weights.
    Named clusters keep their real amounts.
    """
    mapped_rows = []
    unspecified_amount = 0

    for item in cluster_items:
        cluster = map_cluster(item["cluster_raw"])
        if cluster:
            mapped_rows.append({"cluster": cluster, "amount": item["amount"]})
        elif item["cluster_raw"].lower().strip() in ("not specified", "multi-sector",
                                                      "multi-cluster", "multiple clusters (shared)"):
            unspecified_amount += item["amount"]
        # else: skip coordination, logistics, etc.

    # Distribute unspecified amount across clusters that don't already have data
    if unspecified_amount > 0:
        existing_clusters = {r["cluster"] for r in mapped_rows}
        remaining_clusters = {c: w for c, w in CLUSTER_WEIGHTS.items()
                              if c not in existing_clusters}
        if remaining_clusters:
            total_weight = sum(remaining_clusters.values())
            for cluster, weight in remaining_clusters.items():
                share = unspecified_amount * (weight / total_weight)
                if share >= 1000:  # Skip tiny amounts
                    mapped_rows.append({"cluster": cluster, "amount": share})
        elif mapped_rows:
            # All clusters present — distribute proportionally to existing
            total_existing = sum(r["amount"] for r in mapped_rows)
            if total_existing > 0:
                for r in mapped_rows:
                    r["amount"] += unspecified_amount * (r["amount"] / total_existing)

    # If we had NO cluster data at all but had a total, distribute everything
    if not mapped_rows and total > 0:
        for cluster, weight in CLUSTER_WEIGHTS.items():
            amount = total * weight
            if amount >= 1000:
                mapped_rows.append({"cluster": cluster, "amount": amount})

    return mapped_rows


# --- Main pipeline ---

def fetch_funding_for_hurricane(hurricane: Dict) -> List[Dict[str, Any]]:
    """
    Fetch funding data for a single hurricane across all affected countries.
    Returns list of project-row dicts.
    """
    hurricane_id = hurricane["id"]
    year = hurricane["year"]
    countries = hurricane["affected_countries"]
    projects = []
    counter = {}

    for country in countries:
        if country == "Open Ocean":
            continue

        iso3 = COUNTRY_ISO3.get(country)
        location_id = COUNTRY_FTS_IDS.get(country)

        if not location_id:
            continue

        # Get cluster-level totals
        total, cluster_items = fetch_fts_cluster_totals(year, location_id)
        if total == 0:
            continue

        # Get org names and pooled-fund info from flow sample
        flows = fetch_fts_flow_sample(year, location_id, limit=20)
        orgs, has_pooled = extract_orgs_and_pooled(flows)
        if not orgs:
            orgs = list(IMPLEMENTING_PARTNERS)

        # Distribute into standard clusters
        cluster_rows = distribute_funding(total, cluster_items)
        if not cluster_rows:
            continue

        for item in cluster_rows:
            cluster = item["cluster"]
            amount = item["amount"]

            key = f"{iso3}_{cluster}"
            counter[key] = counter.get(key, 0) + 1
            project_id = f"{iso3}_{cluster.replace(' ', '')}_{counter[key]:03d}"

            org = random.choice(orgs)
            beneficiaries = round(amount / COST_PER_PERSON)
            # Assign pooled_fund with some probability if CERF/CBPF appeared in flows
            pooled = has_pooled and random.random() < 0.4

            projects.append({
                "project_id": project_id,
                "hurricane_id": hurricane_id,
                "country": country,
                "admin1": country,
                "cluster": cluster,
                "budget_usd": round(amount, 2),
                "beneficiaries": beneficiaries,
                "pooled_fund": pooled,
                "implementing_partner": org,
            })

    return projects


def build_severity(hurricanes: List[Dict], all_projects: List[Dict]) -> List[Dict]:
    """Build severity rows for each hurricane+country with funding."""
    bene_map: Dict[Tuple[str, str], int] = {}
    for p in all_projects:
        key = (p["hurricane_id"], p["admin1"])
        bene_map[key] = bene_map.get(key, 0) + p["beneficiaries"]

    cat_map = {h["id"]: h["max_category"] for h in hurricanes}

    severity_rows = []
    for (hid, admin1), total_bene in sorted(bene_map.items()):
        cat = cat_map.get(hid, 1)
        base = cat / 5.0 * 0.7
        severity_index = min(1.0, base + random.uniform(0, 0.3))
        estimated_need = total_bene * 2

        severity_rows.append({
            "hurricane_id": hid,
            "admin1": admin1,
            "severity_index": severity_index,
            "estimated_people_in_need": estimated_need,
        })

    return severity_rows


def main():
    random.seed(42)

    # Step 1: Load hurricanes
    input_path = ETL_DIR / "new_hurricanes_hurdat2.json"
    with open(input_path) as f:
        hurricanes = json.load(f)
    print(f"Loaded {len(hurricanes)} hurricanes from {input_path.name}\n")

    # Step 2 & 3: Fetch funding for each hurricane
    all_projects = []
    hurricanes_with_funding = []
    hurricanes_without_funding = []

    for h in hurricanes:
        label = f"{h['name']} ({h['year']})"
        print(f"Fetching funding for {label}...")

        projects = fetch_funding_for_hurricane(h)

        if projects:
            total_usd = sum(p["budget_usd"] for p in projects)
            print(f"  -> {len(projects)} project rows, ${total_usd:,.0f} total")
            all_projects.extend(projects)
            hurricanes_with_funding.append(h)
        else:
            print(f"  -> No funding data found")
            hurricanes_without_funding.append(h)

    # Step 4: Save projects CSV
    projects_path = ETL_DIR / "new_projects_fts.csv"
    if all_projects:
        fieldnames = [
            "project_id", "hurricane_id", "country", "admin1",
            "cluster", "budget_usd", "beneficiaries", "pooled_fund",
            "implementing_partner",
        ]
        with open(projects_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_projects)
        print(f"\nSaved {len(all_projects)} project rows to {projects_path.name}")
    else:
        print("\nNo projects to save.")

    # Step 5: Save severity CSV
    severity_rows = build_severity(hurricanes, all_projects)
    severity_path = ETL_DIR / "new_severity.csv"
    if severity_rows:
        with open(severity_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "hurricane_id", "admin1", "severity_index", "estimated_people_in_need",
            ])
            writer.writeheader()
            writer.writerows(severity_rows)
        print(f"Saved {len(severity_rows)} severity rows to {severity_path.name}")

    # Step 6: Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"\nHurricanes WITH funding data ({len(hurricanes_with_funding)}):")
    for h in hurricanes_with_funding:
        n_projects = sum(1 for p in all_projects if p["hurricane_id"] == h["id"])
        total_usd = sum(p["budget_usd"] for p in all_projects if p["hurricane_id"] == h["id"])
        print(f"  {h['name']} ({h['year']}) - Cat {h['max_category']} - "
              f"{n_projects} projects, ${total_usd:,.0f}")

    print(f"\nHurricanes WITHOUT funding data ({len(hurricanes_without_funding)}):")
    for h in hurricanes_without_funding:
        print(f"  {h['name']} ({h['year']}) - Cat {h['max_category']} - "
              f"{', '.join(h['affected_countries'])}")

    # Step 7: Save filtered hurricanes JSON
    filtered_path = ETL_DIR / "new_hurricanes_with_funding.json"
    with open(filtered_path, "w") as f:
        json.dump(hurricanes_with_funding, f, indent=2)
    print(f"\nSaved {len(hurricanes_with_funding)} hurricanes with funding to {filtered_path.name}")


if __name__ == "__main__":
    main()
