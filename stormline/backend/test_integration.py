#!/usr/bin/env python3
"""Quick integration test"""
import sys
import os

print("=" * 70)
print("🧪 DATABRICKS INTEGRATION TEST")
print("=" * 70)

# Test 1: Mode detection
print("\nTest 1: Mode Detection")
server = os.getenv("DATABRICKS_SERVER_HOSTNAME")
print(f"  Mode: {'Databricks' if server else 'DuckDB (local)'}")

# Test 2: Import modules
print("\nTest 2: Module Imports")
try:
    from data_loader import initialize_database
    print("  ✓ data_loader imported")
    from databricks_client import DatabricksConnection
    print("  ✓ databricks_client imported")
except Exception as e:
    print(f"  ✗ Import failed: {e}")
    sys.exit(1)

# Test 3: Initialize DB
print("\nTest 3: Database Initialization")
try:
    db = initialize_database()
    print(f"  ✓ Database initialized: {db.__class__.__name__}")
except Exception as e:
    print(f"  ✗ Init failed: {e}")
    sys.exit(1)

# Test 4: Query test
print("\nTest 4: Query Execution")
try:
    result = db.execute("SELECT COUNT(*) as count FROM hurricanes")
    count = result.fetchone()[0]
    print(f"  ✓ Query successful: {count} hurricanes found")
except Exception as e:
    print(f"  ✗ Query failed: {e}")
    sys.exit(1)

# Test 5: Parameterized query
print("\nTest 5: Parameterized Query")
try:
    result = db.execute(
        "SELECT COUNT(*) FROM projects WHERE budget_usd > ?",
        [500000]
    )
    count = result.fetchone()[0]
    print(f"  ✓ Parameterized query: {count} projects > $500k")
except Exception as e:
    print(f"  ✗ Parameterized query failed: {e}")
    sys.exit(1)

# Test 6: Analysis import
print("\nTest 6: Analysis Module")
try:
    from analysis import get_coverage
    coverage = get_coverage(db)
    print(f"  ✓ Analysis working: {len(coverage)} regions analyzed")
except Exception as e:
    print(f"  ✗ Analysis failed: {e}")
    sys.exit(1)

print("\n" + "=" * 70)
print("✅ ALL TESTS PASSED!")
print("=" * 70)
print("\nBackend is ready. Run: python -m uvicorn main:app --reload")
