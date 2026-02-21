#!/bin/bash
# Start the StormLine backend server

cd "$(dirname "$0")"
source venv/bin/activate

echo "Starting StormLine Backend Server..."
echo "Server will run on http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""

python main_simple.py
