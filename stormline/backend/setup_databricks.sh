#!/bin/bash
# Quick setup script for Databricks integration
# Usage: bash setup_databricks.sh

set -e

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "🚀 Databricks SQL Warehouse Setup"
echo "================================="
echo ""

# Step 1: Check credentials
echo "📋 Step 1: Checking Databricks credentials..."
if [ -f "$BACKEND_DIR/.env" ]; then
    echo "   ✓ .env file found"
    set -a
    source "$BACKEND_DIR/.env"
    set +a
else
    echo "   ⚠️  No .env file found"
    echo ""
    echo "   Create one with your Databricks credentials:"
    echo "   cp .env.example .env"
    echo ""
    echo "   Then edit .env with:"
    echo "   - DATABRICKS_SERVER_HOSTNAME=adb-xxxx.azuredatabricks.net"
    echo "   - DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/xxxxx"
    echo "   - DATABRICKS_PAT=dapixxx..."
    echo ""
    exit 1
fi

# Step 2: Install dependencies
echo ""
echo "📦 Step 2: Installing dependencies..."
pip install -q requests python-dotenv 2>/dev/null || echo "   Note: requests and python-dotenv already installed"
echo "   ✓ Dependencies installed"

# Step 3: Verify Databricks connection
echo ""
echo "🔗 Step 3: Testing Databricks connection..."
python3 << 'EOF'
import os
import sys
from databricks_client import DatabricksConnection

server = os.getenv("DATABRICKS_SERVER_HOSTNAME")
path = os.getenv("DATABRICKS_HTTP_PATH")
pat = os.getenv("DATABRICKS_PAT")

if not all([server, path, pat]):
    print("   ❌ Missing credentials in .env")
    sys.exit(1)

try:
    conn = DatabricksConnection(
        server_hostname=server,
        http_path=path,
        personal_access_token=pat
    )
    # Simple test query
    result = conn.execute("SELECT 1 as test")
    print("   ✓ Connection successful!")
except Exception as e:
    print(f"   ❌ Connection failed: {e}")
    sys.exit(1)
EOF

# Step 4: Load data
echo ""
echo "📊 Step 4: Loading data to Databricks..."
python3 "$BACKEND_DIR/data_loader_databricks.py"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next: Start the backend"
echo "  uvicorn main:app --reload"
echo ""
echo "Then test:"
echo "  curl http://localhost:8000/hurricanes"
