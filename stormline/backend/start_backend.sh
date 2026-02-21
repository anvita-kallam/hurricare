#!/bin/bash
# Start the HurriCare backend server

cd "$(dirname "$0")"
source venv/bin/activate

echo "Starting HurriCare Backend Server..."
echo "Server will run on http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""

python main_simple.py
