#!/bin/bash
# Stop any existing backend on port 8000, then start fresh

cd "$(dirname "$0")"

echo "Stopping any process on port 8000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
sleep 1

echo "Starting HurriCare backend..."
python3 main_simple.py
