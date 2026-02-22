"""
Minimal Databricks SQL Warehouse client wrapper.
Provides execute() interface compatible with DuckDB for drop-in replacement.
"""
import requests
import json
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urljoin
import time


class DatabricksQueryResult:
    """Mimics DuckDB result set."""
    
    def __init__(self, columns: List[str], rows: List[List[Any]]):
        self.columns = columns
        self.rows = rows
        self._index = 0
    
    def fetch_all(self) -> List[Tuple]:
        """Fetch all rows as tuples (like DuckDB)."""
        return [tuple(row) for row in self.rows]
    
    def fetchall(self) -> List[Tuple]:
        """Alias for fetch_all."""
        return self.fetch_all()
    
    def fetchone(self) -> Optional[Tuple]:
        """Fetch single row."""
        if self._index < len(self.rows):
            row = tuple(self.rows[self._index])
            self._index += 1
            return row
        return None
    
    def close(self):
        """No-op for compatibility."""
        pass


class DatabricksConnection:
    """
    Lightweight wrapper for Databricks SQL Warehouse.
    Mimics DuckDB connection interface for easy drop-in replacement.
    """
    
    def __init__(self, 
                 server_hostname: str,
                 http_path: str,
                 personal_access_token: str,
                 catalog: str = "hive_metastore",
                 schema: str = "stormline",
                 warehouse_timeout_seconds: int = 60):
        """
        Initialize Databricks SQL Warehouse connection.
        
        Args:
            server_hostname: e.g., "adb-123456789.azuredatabricks.net"
            http_path: e.g., "/sql/1.0/warehouses/abc123def456"
            personal_access_token: Databricks PAT
            catalog: Catalog name (default: hive_metastore)
            schema: Schema name (default: stormline)
            warehouse_timeout_seconds: Statement timeout
        """
        self.server_hostname = server_hostname
        self.http_path = http_path
        self.personal_access_token = personal_access_token
        self.catalog = catalog
        self.schema = schema
        self.warehouse_timeout_seconds = warehouse_timeout_seconds
        
        self.api_base_url = f"https://{server_hostname}/api/2.0"
        self.headers = {
            "Authorization": f"Bearer {personal_access_token}",
            "Content-Type": "application/json"
        }
    
    def execute(self, sql: str, params: Optional[List[Any]] = None) -> DatabricksQueryResult:
        """
        Execute SQL query and return result set.
        
        Args:
            sql: SQL query string (can include ? placeholders)
            params: Query parameters (optional)
        
        Returns:
            DatabricksQueryResult with columns and rows
        """
        # Replace ? with actual values (simple parameter substitution)
        if params:
            for param in params:
                if isinstance(param, str):
                    # Escape single quotes for SQL
                    escaped = param.replace("'", "''")
                    sql = sql.replace("?", f"'{escaped}'", 1)
                elif param is None:
                    sql = sql.replace("?", "NULL", 1)
                else:
                    sql = sql.replace("?", str(param), 1)
        
        # Add catalog and schema if not specified
        if "FROM " in sql.upper() and self.schema not in sql.upper():
            # Simple heuristic: add schema to bare table names
            sql = sql.replace(
                f" FROM ", 
                f" FROM {self.catalog}.{self.schema}.",
                1
            )
        
        # Execute query
        statement_response = self._execute_query(sql)
        
        # Parse results
        columns = [col["name"] for col in statement_response.get("manifest", {}).get("columns", [])]
        rows = statement_response.get("result", {}).get("data_array", [])
        
        return DatabricksQueryResult(columns, rows)
    
    def _execute_query(self, sql: str) -> Dict:
        """
        Execute query via Databricks SQL Statement Execution API.
        
        Polls for completion since this is an async API.
        """
        # Create statement
        create_url = urljoin(self.api_base_url, "/statements")
        payload = {
            "statement": sql,
            "warehouse_id": self.http_path.split("/")[-1]  # Extract warehouse ID
        }
        
        response = requests.post(create_url, json=payload, headers=self.headers)
        response.raise_for_status()
        statement_id = response.json()["statement_id"]
        
        # Poll for completion
        get_url = urljoin(self.api_base_url, f"/statements/{statement_id}")
        start_time = time.time()
        
        while True:
            response = requests.get(get_url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            
            status = data.get("status")
            if status == "SUCCEEDED":
                return data
            elif status == "FAILED":
                raise Exception(f"Query failed: {data.get('message', 'Unknown error')}")
            elif status in ("CANCELED", "CLOSED"):
                raise Exception(f"Query was {status}")
            
            # Timeout check
            if time.time() - start_time > self.warehouse_timeout_seconds:
                raise TimeoutError(f"Query execution exceeded {self.warehouse_timeout_seconds}s")
            
            time.sleep(0.5)
    
    def create_table(self, 
                    table_name: str, 
                    schema_dict: Dict[str, str],
                    is_delta: bool = True):
        """
        Create a table in Databricks.
        
        Args:
            table_name: Name of table to create
            schema_dict: {'column_name': 'data_type', ...}
            is_delta: Use Delta format (default: True)
        """
        columns_sql = ", ".join([f"{col} {dtype}" for col, dtype in schema_dict.items()])
        storage = "USING DELTA" if is_delta else ""
        
        sql = f"""
            CREATE TABLE IF NOT EXISTS {self.catalog}.{self.schema}.{table_name} (
                {columns_sql}
            )
            {storage}
        """
        
        self.execute(sql)
    
    def insert_rows(self, table_name: str, columns: List[str], rows: List[List[Any]]):
        """
        Insert rows into table.
        
        Args:
            table_name: Name of table
            columns: List of column names
            rows: List of [value1, value2, ...] lists
        """
        if not rows:
            return
        
        full_table_name = f"{self.catalog}.{self.schema}.{table_name}"
        columns_str = ", ".join(columns)
        
        # Build VALUES clause
        values_parts = []
        for row in rows:
            # Format each value
            formatted_vals = []
            for val in row:
                if val is None:
                    formatted_vals.append("NULL")
                elif isinstance(val, str):
                    # Escape single quotes
                    escaped = val.replace("'", "''")
                    formatted_vals.append(f"'{escaped}'")
                elif isinstance(val, bool):
                    formatted_vals.append("true" if val else "false")
                elif isinstance(val, (int, float)):
                    formatted_vals.append(str(val))
                else:
                    # Default: convert to string
                    formatted_vals.append(f"'{str(val)}'")
            
            values_parts.append(f"({', '.join(formatted_vals)})")
        
        values_clause = ", ".join(values_parts)
        
        sql = f"INSERT INTO {full_table_name} ({columns_str}) VALUES {values_clause}"
        self.execute(sql)
    
    def drop_table(self, table_name: str, if_exists: bool = True):
        """Drop a table."""
        if_exists_clause = "IF EXISTS" if if_exists else ""
        sql = f"DROP TABLE {if_exists_clause} {self.catalog}.{self.schema}.{table_name}"
        self.execute(sql)
