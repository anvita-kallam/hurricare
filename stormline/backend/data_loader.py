import duckdb
import json
import csv
from pathlib import Path
from typing import List, Dict
import os


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


def initialize_database(data_dir: str = "sample_data") -> duckdb.DuckDBPyConnection:
    """Initialize DuckDB with sample data."""
    conn = duckdb.connect(':memory:')
    
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    data_path = script_dir / data_dir
    
    # Load hurricanes
    hurricanes_file = data_path / "hurricanes.json"
    if hurricanes_file.exists():
        hurricanes = load_json_data(str(hurricanes_file))
        
        # Create hurricanes table
        conn.execute("""
            CREATE TABLE hurricanes (
                id VARCHAR,
                name VARCHAR,
                year INTEGER,
                max_category INTEGER,
                track JSON,
                affected_countries JSON,
                estimated_population_affected INTEGER
            )
        """)
        
        for h in hurricanes:
            conn.execute("""
                INSERT INTO hurricanes VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [
                h['id'],
                h['name'],
                h['year'],
                h['max_category'],
                json.dumps(h['track']),
                json.dumps(h['affected_countries']),
                h['estimated_population_affected']
            ])
    
    # Load projects
    projects_file = data_path / "projects.csv"
    if projects_file.exists():
        projects = load_csv_data(str(projects_file))
        
        conn.execute("""
            CREATE TABLE projects (
                project_id VARCHAR,
                hurricane_id VARCHAR,
                country VARCHAR,
                admin1 VARCHAR,
                cluster VARCHAR,
                budget_usd DOUBLE,
                beneficiaries INTEGER,
                pooled_fund BOOLEAN,
                implementing_partner VARCHAR
            )
        """)
        
        for p in projects:
            conn.execute("""
                INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                p['project_id'],
                p['hurricane_id'],
                p['country'],
                p['admin1'],
                p['cluster'],
                p['budget_usd'],
                p['beneficiaries'],
                p['pooled_fund'],
                p['implementing_partner']
            ])
    
    # Load severity
    severity_file = data_path / "severity.csv"
    if severity_file.exists():
        severity = load_csv_data(str(severity_file))
        
        conn.execute("""
            CREATE TABLE severity (
                hurricane_id VARCHAR,
                admin1 VARCHAR,
                severity_index DOUBLE,
                estimated_people_in_need INTEGER
            )
        """)
        
        for s in severity:
            conn.execute("""
                INSERT INTO severity VALUES (?, ?, ?, ?)
            """, [
                s['hurricane_id'],
                s['admin1'],
                s['severity_index'],
                s['estimated_people_in_need']
            ])
    
    return conn
