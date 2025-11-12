#!/bin/sh
# Startup script for Railway deployment

# Set default PORT if not provided
PORT=${PORT:-5050}

echo "Starting gunicorn on port $PORT"

# Start gunicorn
exec gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 app.app:app
