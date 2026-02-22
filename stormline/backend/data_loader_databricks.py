"""
Data loader for Databricks Delta Lake.
Loads CSV/JSON data into Databricks tables.

Run this one-time setup script:
  python backend/data_loader_databricks.py
"""
import json
import csv
from pathlib import Path
from typing import List, Dict
from databricks_client import DatabricksConnection


def load_json_data(file_path: str) -> List[Dict]:
    """Load JSON data from file."""
    with open(file_path, 'r') as f:
        return json.load(f)


def load_csv_data(file_path: str) -> List[Dict]:
    """Load CSV data from file."""
    data = []
    with open(file_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert numeric fields
            for key, value in row.items():
                if key in ['year', 'max_category', 'wind', 'estimated_population_affected', 
                          'budget_usd', 'beneficiaries', 'severity_index', 'estimated_people_in_need']:
                    try:
                        row[key] = float(value) if '.' in value else int(value)
                    except (ValueError, TypeError):
                        pass
                elif key == 'pooled_fund':
                    row[key] = value.lower() in ('true', '1', 'yes')
            data.append(row)
    return data


def initialize_databricks(
    server_hostname: str,
    http_path: str,
    personal_access_token: str,
    data_dir: str = "sample_data"
) -> DatabricksConnection:
    """
    Initialize Databricks with sample data.
    
    Args:
        server_hostname: e.g., "adb-123456789.azuredatabricks.net"
        http_path: e.g., "/sql/1.0/warehouses/abc123def456"
        personal_access_token: Your Databricks PAT
        data_dir: Directory with sample data files
    
    Returns:
        DatabricksConnection ready to use
    """
    conn = DatabricksConnection(
        server_hostname=server_hostname,
        http_path=http_path,
        personal_access_token=personal_access_token
    )
    
    script_dir = Path(__file__).parent
    data_path = script_dir / data_dir
    
    print("Initializing Databricks Delta Lake tables...")
    
    # Load hurricanes
    print("\n1. Loading hurricanes...")
    hurricanes_file = data_path / "hurricanes.json"
    if hurricanes_file.exists():
        hurricanes = load_json_data(str(hurricanes_file))
        
        # Create table
        conn.create_table("hurricanes", {
            "id": "STRING",
            "name": "STRING",
            "year": "INT",
            "max_category": "INT",
            "track": "STRING",  # JSON as string
            "affected_countries": "STRING",  # JSON as string
            "estimated_population_affected": "INT"
        })
        
        # Load data
        rows = [
            [
                h['id'],
                h['name'],
                h['year'],
                h['max_category'],
                json.dumps(h['track']),
                json.dumps(h['affected_countries']),
                h['estimated_population_affected']
            ]
            for h in hurricanes
        ]
        
        conn.insert_rows("hurricanes", 
            ["id", "name", "year", "max_category", "track", "affected_countries", "estimated_population_affected"],
            rows)
        
        print(f"   ✓ Loaded {len(hurricanes)} hurricanes")
    
    # Load projects
    print("2. Loading projects...")
    projects_file = data_path / "projects.csv"
    if projects_file.exists():
        projects = load_csv_data(str(projects_file))
        
        conn.create_table("projects", {
            "project_id": "STRING",
            "hurricane_id": "STRING",
            "country": "STRING",
            "admin1": "STRING",
            "cluster": "STRING",
            "budget_usd": "DOUBLE",
            "beneficiaries": "INT",
            "pooled_fund": "BOOLEAN",
            "implementing_partner": "STRING"
        })
        
        rows = [
            [
                p['project_id'],
                p['hurricane_id'],
                p['country'],
                p['admin1'],
                p['cluster'],
                p['budget_usd'],
                p['beneficiaries'],
                p['pooled_fund'],
                p['implementing_partner']
            ]
            for p in projects
        ]
        
        conn.insert_rows("projects",
            ["project_id", "hurricane_id", "country", "admin1", "cluster", "budget_usd", "beneficiaries", "pooled_fund", "implementing_partner"],
            rows)
        
        print(f"   ✓ Loaded {len(projects)} projects")
    
    # Load severity
    print("3. Loading severity...")
    severity_file = data_path / "severity.csv"
    if severity_file.exists():
        severity = load_csv_data(str(severity_file))
        
        conn.create_table("severity", {
            "hurricane_id": "STRING",
            "admin1": "STRING",
            "severity_index": "DOUBLE",
            "estimated_people_in_need": "INT"
        })
        
        rows = [
            [
                s['hurricane_id'],
                s['admin1'],
                s['severity_index'],
                s['estimated_people_in_need']
            ]
            for s in severity
        ]
        
        conn.insert_rows("severity",
            ["hurricane_id", "admin1", "severity_index", "estimated_people_in_need"],
            rows)
        
        print(f"   ✓ Loaded {len(severity)} severity records")
    
    # Load ideal plans
    print("4. Loading ideal response plans...")
    ideal_plans_file = data_path / "ideal_hurricane_response_plans.csv"
    if ideal_plans_file.exists():
        ideal_plans = load_csv_data(str(ideal_plans_file))
        
        conn.create_table("ideal_plans", {
            "id": "STRING",
            "name": "STRING",
            "year": "INT",
            "affected_countries": "STRING",
            "estimated_population_affected": "INT",
            "ideal_plan_text": "STRING"
        })
        
        rows = [
            [
                plan.get('id', ''),
                plan.get('name', ''),
                int(plan.get('year', 0)) if plan.get('year') else 0,
                plan.get('affected_countries', ''),
                int(plan.get('estimated_population_affected', 0)) if plan.get('estimated_population_affected') else 0,
                plan.get('ideal_plan_text', '')
            ]
            for plan in ideal_plans
        ]
        
        conn.insert_rows("ideal_plans",
            ["id", "name", "year", "affected_countries", "estimated_population_affected", "ideal_plan_text"],
            rows)
        
        print(f"   ✓ Loaded {len(ideal_plans)} ideal plans")
    
    print("\n✅ Databricks Delta Lake initialization complete!")
    print("\nNow update your backend/.env with:")
    print("  DATABRICKS_SERVER_HOSTNAME=<your-host>.azuredatabricks.net")
    print("  DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/<warehouse-id>")
    print("  DATABRICKS_PAT=<your-personal-access-token>")
    
    return conn


if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # Get config from environment
    server_hostname = os.getenv("DATABRICKS_SERVER_HOSTNAME")
    http_path = os.getenv("DATABRICKS_HTTP_PATH")
    pat = os.getenv("DATABRICKS_PAT")
    
    if not all([server_hostname, http_path, pat]):
        print("❌ Missing Databricks credentials!")
        print("\nSet these environment variables:")
        print("  export DATABRICKS_SERVER_HOSTNAME=...")
        print("  export DATABRICKS_HTTP_PATH=...")
        print("  export DATABRICKS_PAT=...")
        exit(1)
    
    initialize_databricks(server_hostname, http_path, pat)
