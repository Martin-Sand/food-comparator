#!/bin/sh
# Startup script for Railway deployment

set -eu

# Set default PORT if not provided
PORT=${PORT:-8080}

echo "Running database migrations..."

# Railway Postgres can take a few seconds to become available after deploy.
# Retry a few times so we don't crash-loop before the DB is ready.
attempt=1
max_attempts=10
while [ "$attempt" -le "$max_attempts" ]; do
	if flask --app app.app:app db upgrade; then
		echo "Database migrations complete."
		break
	fi

	echo "Migration attempt $attempt/$max_attempts failed; retrying in 5s..."
	attempt=$((attempt + 1))
	sleep 5
done

if [ "$attempt" -gt "$max_attempts" ]; then
	echo "Database migrations failed after $max_attempts attempts. Exiting."
	exit 1
fi

echo "Starting gunicorn on port $PORT"

# Start gunicorn
exec gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 app.app:app
