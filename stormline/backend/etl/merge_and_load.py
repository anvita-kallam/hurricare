"""
Merge new hurricane ETL data with existing dataset and load to Databricks.
"""

import csv
import json
import os
import shutil
import sys
from pathlib import Path

# Add backend dir to path so we can import databricks_client
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
from databricks_client import DatabricksConnection

load_dotenv(BACKEND_DIR / ".env")

SAMPLE_DIR = BACKEND_DIR / "sample_data"
ETL_DIR = Path(__file__).parent

SECTOR_ACTIONS = {
    "WASH": "Ensure access to clean water and sanitation to prevent disease outbreaks.",
    "Health": "Provide immediate health services, including mobile clinics and medical supplies.",
    "Shelter": "Deploy emergency shelters and repair homes for displaced families.",
    "Food Security": "Distribute emergency food rations and restore food supply chains.",
    "Protection": "Safeguard vulnerable groups and prevent exploitation and abuse.",
    "Livelihoods": "Support recovery of jobs and income-generating activities.",
    "Education": "Reopen schools and provide learning materials for children.",
    "Energy": "Restore power and critical infrastructure for relief operations.",
}


# --- File I/O helpers ---

def load_json(path: Path):
    with open(path) as f:
        return json.load(f)


def save_json(path: Path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def load_csv_rows(path: Path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def save_csv_rows(path: Path, rows, fieldnames):
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def backup(path: Path):
    if path.exists():
        bak = path.with_suffix(path.suffix + ".bak")
        shutil.copy2(path, bak)
        print(f"  Backed up {path.name} -> {bak.name}")


# --- Ideal plan generation ---

def generate_ideal_plan(hurricane, projects):
    """Generate ideal_plan_text matching the existing format."""
    name = hurricane["name"]
    year = hurricane["year"]
    countries = hurricane["affected_countries"]
    pop = hurricane["estimated_population_affected"]

    # Aggregate per cluster
    cluster_stats = {}
    for p in projects:
        c = p["cluster"]
        if c not in cluster_stats:
            cluster_stats[c] = {"beneficiaries": 0, "budget": 0.0}
        cluster_stats[c]["beneficiaries"] += int(p.get("beneficiaries", 0))
        cluster_stats[c]["budget"] += float(p.get("budget_usd", 0))

    # Sort by beneficiaries descending (matches existing format)
    sorted_clusters = sorted(cluster_stats.items(), key=lambda x: x[1]["beneficiaries"], reverse=True)

    countries_str = ", ".join(c for c in countries if c != "Open Ocean")

    lines = [
        f"Ideal Response Plan for {name} ({year})",
        "",
        f"Affected countries/territories: {countries_str}",
        f"Estimated population affected: {pop:,}",
        "",
        "Key priorities:",
    ]

    for cluster, stats in sorted_clusters:
        lines.append(
            f"- {cluster}: Support {stats['beneficiaries']:,} people "
            f"with a budget of ${stats['budget']:,.0f}."
        )

    lines.append("")
    lines.append("Sector-specific actions:")
    for cluster, _ in sorted_clusters:
        action = SECTOR_ACTIONS.get(cluster)
        if action:
            lines.append(f"- {action}")

    lines.append("")
    lines.append(
        "All actions follow UN best-practice humanitarian response standards, "
        "prioritizing life-saving interventions, disease prevention, and rapid recovery."
    )

    return "\n".join(lines)


# --- Databricks loading ---

def load_to_databricks(hurricanes, projects, severity, ideal_plans):
    """Drop and recreate all 4 tables in Databricks with merged data."""
    hostname = os.environ.get("DATABRICKS_SERVER_HOSTNAME")
    http_path = os.environ.get("DATABRICKS_HTTP_PATH")
    pat = os.environ.get("DATABRICKS_PAT")

    if not all([hostname, http_path, pat]):
        print("\nSkipping Databricks load — credentials not set in .env")
        return False

    conn = DatabricksConnection(
        server_hostname=hostname,
        http_path=http_path,
        personal_access_token=pat,
    )

    print("\nLoading to Databricks...")
    conn.execute(f"CREATE SCHEMA IF NOT EXISTS {conn.catalog}.{conn.schema}")

    # --- Hurricanes ---
    print("  1. Hurricanes...")
    conn.drop_table("hurricanes")
    conn.create_table("hurricanes", {
        "id": "STRING",
        "name": "STRING",
        "year": "INT",
        "max_category": "INT",
        "track": "STRING",
        "affected_countries": "STRING",
        "estimated_population_affected": "INT",
    })
    cols = ["id", "name", "year", "max_category", "track",
            "affected_countries", "estimated_population_affected"]
    # Batch in chunks of 20 to avoid SQL size limits
    rows = [
        [h["id"], h["name"], h["year"], h["max_category"],
         json.dumps(h["track"]), json.dumps(h["affected_countries"]),
         h["estimated_population_affected"]]
        for h in hurricanes
    ]
    for i in range(0, len(rows), 20):
        conn.insert_rows("hurricanes", cols, rows[i:i+20])
    print(f"     {len(rows)} hurricanes loaded")

    # --- Projects ---
    print("  2. Projects...")
    conn.drop_table("projects")
    conn.create_table("projects", {
        "project_id": "STRING",
        "hurricane_id": "STRING",
        "country": "STRING",
        "admin1": "STRING",
        "cluster": "STRING",
        "budget_usd": "DOUBLE",
        "beneficiaries": "INT",
        "pooled_fund": "BOOLEAN",
        "implementing_partner": "STRING",
    })
    cols = ["project_id", "hurricane_id", "country", "admin1", "cluster",
            "budget_usd", "beneficiaries", "pooled_fund", "implementing_partner"]
    rows = [
        [p["project_id"], p["hurricane_id"], p["country"], p["admin1"],
         p["cluster"], float(p["budget_usd"]), int(p["beneficiaries"]),
         str(p["pooled_fund"]).lower() in ("true", "1", "yes"),
         p["implementing_partner"]]
        for p in projects
    ]
    for i in range(0, len(rows), 20):
        conn.insert_rows("projects", cols, rows[i:i+20])
    print(f"     {len(rows)} projects loaded")

    # --- Severity ---
    print("  3. Severity...")
    conn.drop_table("severity")
    conn.create_table("severity", {
        "hurricane_id": "STRING",
        "admin1": "STRING",
        "severity_index": "DOUBLE",
        "estimated_people_in_need": "INT",
    })
    cols = ["hurricane_id", "admin1", "severity_index", "estimated_people_in_need"]
    rows = [
        [s["hurricane_id"], s["admin1"],
         float(s["severity_index"]), int(s["estimated_people_in_need"])]
        for s in severity
    ]
    for i in range(0, len(rows), 20):
        conn.insert_rows("severity", cols, rows[i:i+20])
    print(f"     {len(rows)} severity records loaded")

    # --- Ideal plans ---
    print("  4. Ideal plans...")
    conn.drop_table("ideal_plans")
    conn.create_table("ideal_plans", {
        "id": "STRING",
        "name": "STRING",
        "year": "INT",
        "affected_countries": "STRING",
        "estimated_population_affected": "INT",
        "ideal_plan_text": "STRING",
    })
    cols = ["id", "name", "year", "affected_countries",
            "estimated_population_affected", "ideal_plan_text"]
    rows = [
        [p.get("id", ""), p.get("name", ""),
         int(p["year"]) if p.get("year") else 0,
         p.get("affected_countries", ""),
         int(p["estimated_population_affected"]) if p.get("estimated_population_affected") else 0,
         p.get("ideal_plan_text", "")]
        for p in ideal_plans
    ]
    for i in range(0, len(rows), 5):
        conn.insert_rows("ideal_plans", cols, rows[i:i+5])
    print(f"     {len(rows)} ideal plans loaded")

    # Verify
    print("\n  Verifying...")
    for table in ["hurricanes", "projects", "severity", "ideal_plans"]:
        result = conn.execute(f"SELECT COUNT(*) FROM {conn.catalog}.{conn.schema}.{table}")
        count = result.fetchone()[0]
        print(f"    {table}: {count} rows")

    return True


# --- Main ---

def main():
    print("=" * 60)
    print("MERGE AND LOAD — Combining datasets and loading to Databricks")
    print("=" * 60)

    # Step 1: Load existing data
    print("\n--- Step 1: Loading existing data ---")
    existing_hurricanes = load_json(SAMPLE_DIR / "hurricanes.json")
    existing_projects = load_csv_rows(SAMPLE_DIR / "projects.csv")
    existing_severity = load_csv_rows(SAMPLE_DIR / "severity.csv")
    existing_plans = load_csv_rows(SAMPLE_DIR / "ideal_hurricane_response_plans.csv")
    print(f"  Existing: {len(existing_hurricanes)} hurricanes, {len(existing_projects)} projects, "
          f"{len(existing_severity)} severity, {len(existing_plans)} plans")

    # Step 2: Load new data
    print("\n--- Step 2: Loading new ETL data ---")
    new_hurricanes = load_json(ETL_DIR / "new_hurricanes_with_funding.json")
    new_projects = load_csv_rows(ETL_DIR / "new_projects_fts.csv")
    new_severity = load_csv_rows(ETL_DIR / "new_severity.csv")
    print(f"  New: {len(new_hurricanes)} hurricanes, {len(new_projects)} projects, "
          f"{len(new_severity)} severity")

    # Step 3: Merge (deduplicate hurricanes by id)
    print("\n--- Step 3: Merging ---")
    existing_ids = {h["id"] for h in existing_hurricanes}
    added_hurricanes = [h for h in new_hurricanes if h["id"] not in existing_ids]
    skipped = len(new_hurricanes) - len(added_hurricanes)
    if skipped:
        print(f"  Skipped {skipped} duplicate hurricane(s)")

    merged_hurricanes = existing_hurricanes + added_hurricanes
    merged_projects = existing_projects + new_projects
    merged_severity = existing_severity + new_severity
    print(f"  Merged: {len(merged_hurricanes)} hurricanes, {len(merged_projects)} projects, "
          f"{len(merged_severity)} severity")

    # Step 6 (before step 4 so plans can use updated pop): Update estimated_population_affected
    print("\n--- Step 6: Updating estimated_population_affected ---")
    severity_pop = {}
    for s in merged_severity:
        hid = s["hurricane_id"]
        severity_pop[hid] = severity_pop.get(hid, 0) + int(s["estimated_people_in_need"])

    updated_count = 0
    for h in merged_hurricanes:
        if h["id"] in severity_pop and h["estimated_population_affected"] == 0:
            h["estimated_population_affected"] = severity_pop[h["id"]]
            updated_count += 1
    print(f"  Updated population for {updated_count} hurricanes from severity data")

    # Step 4: Generate ideal plans for new hurricanes
    print("\n--- Step 4: Generating ideal plans ---")
    existing_plan_ids = {p["id"] for p in existing_plans}
    new_plan_count = 0

    for h in added_hurricanes:
        if h["id"] in existing_plan_ids:
            continue

        h_projects = [p for p in merged_projects if p["hurricane_id"] == h["id"]]
        if not h_projects:
            continue

        plan_text = generate_ideal_plan(h, h_projects)
        countries_str = ", ".join(c for c in h["affected_countries"] if c != "Open Ocean")

        existing_plans.append({
            "id": h["id"],
            "name": h["name"],
            "year": h["year"],
            "affected_countries": countries_str,
            "estimated_population_affected": h["estimated_population_affected"],
            "ideal_plan_text": plan_text,
        })
        new_plan_count += 1

    merged_plans = existing_plans
    print(f"  Generated {new_plan_count} new ideal plans (total: {len(merged_plans)})")

    # Step 5: Save merged data (backup first)
    print("\n--- Step 5: Saving merged data ---")
    for path in [SAMPLE_DIR / "hurricanes.json", SAMPLE_DIR / "projects.csv",
                 SAMPLE_DIR / "severity.csv", SAMPLE_DIR / "ideal_hurricane_response_plans.csv"]:
        backup(path)

    save_json(SAMPLE_DIR / "hurricanes.json", merged_hurricanes)
    print(f"  Saved hurricanes.json ({len(merged_hurricanes)} records)")

    save_csv_rows(SAMPLE_DIR / "projects.csv", merged_projects,
                  ["project_id", "hurricane_id", "country", "admin1", "cluster",
                   "budget_usd", "beneficiaries", "pooled_fund", "implementing_partner"])
    print(f"  Saved projects.csv ({len(merged_projects)} records)")

    save_csv_rows(SAMPLE_DIR / "severity.csv", merged_severity,
                  ["hurricane_id", "admin1", "severity_index", "estimated_people_in_need"])
    print(f"  Saved severity.csv ({len(merged_severity)} records)")

    save_csv_rows(SAMPLE_DIR / "ideal_hurricane_response_plans.csv", merged_plans,
                  ["id", "name", "year", "affected_countries",
                   "estimated_population_affected", "ideal_plan_text"])
    print(f"  Saved ideal_hurricane_response_plans.csv ({len(merged_plans)} records)")

    # Step 7: Load to Databricks
    print("\n--- Step 7: Loading to Databricks ---")
    db_ok = load_to_databricks(merged_hurricanes, merged_projects, merged_severity, merged_plans)

    # Step 8: Summary
    print("\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)
    print(f"  Total hurricanes: {len(merged_hurricanes)} ({len(added_hurricanes)} new)")
    print(f"  Total projects:   {len(merged_projects)} ({len(new_projects)} new)")
    print(f"  Total severity:   {len(merged_severity)} ({len(new_severity)} new)")
    print(f"  Total plans:      {len(merged_plans)} ({new_plan_count} new)")
    print(f"  Databricks load:  {'SUCCESS' if db_ok else 'SKIPPED'}")
    print()

    if added_hurricanes:
        print("New hurricanes added:")
        for h in added_hurricanes:
            print(f"  {h['name']} ({h['year']}) - Cat {h['max_category']} - "
                  f"Pop {h['estimated_population_affected']:,}")


if __name__ == "__main__":
    main()
