#!/bin/sh
# Startup script for Railway deployment

set -eu

# Set default PORT if not provided
PORT=${PORT:-8080}

echo "Running database migrations..."
flask --app app.app:app db upgrade

echo "Starting gunicorn on port $PORT"

# Start gunicorn
exec gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 app.app:app
