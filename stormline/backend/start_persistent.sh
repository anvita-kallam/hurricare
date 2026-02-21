#!/bin/bash
# Persistent backend startup script for HurriCare
# This script ensures the backend stays running and restarts if it crashes

cd "$(dirname "$0")"
SCRIPT_DIR=$(pwd)
LOG_FILE="/tmp/stormline_backend.log"
PID_FILE="/tmp/stormline_backend.pid"

# Function to start the backend
start_backend() {
          echo "Starting HurriCare Backend Server..."
    echo "Log file: $LOG_FILE"
    echo "PID file: $PID_FILE"
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Start the server in the background
    nohup python main.py >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    
    echo "Backend started with PID: $(cat $PID_FILE)"
    echo "Check logs with: tail -f $LOG_FILE"
    echo "Stop with: kill \$(cat $PID_FILE)"
}

# Function to stop the backend
stop_backend() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "Stopping backend (PID: $PID)..."
            kill "$PID"
            rm "$PID_FILE"
            echo "Backend stopped"
        else
            echo "Backend process not found"
            rm "$PID_FILE"
        fi
    else
        echo "No PID file found. Backend may not be running."
    fi
}

# Function to check status
status_backend() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "Backend is running (PID: $PID)"
            echo "Last 10 lines of log:"
            tail -10 "$LOG_FILE"
        else
            echo "Backend is not running (stale PID file)"
            rm "$PID_FILE"
        fi
    else
        echo "Backend is not running"
    fi
}

# Main command handling
case "$1" in
    start)
        start_backend
        ;;
    stop)
        stop_backend
        ;;
    restart)
        stop_backend
        sleep 2
        start_backend
        ;;
    status)
        status_backend
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
