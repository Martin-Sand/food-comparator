#!/usr/bin/env python3
import os
import sys

# Get PORT from environment or use default
port = os.environ.get('PORT', '8080')

print(f"Starting gunicorn on port {port}")
sys.stdout.flush()

# Execute gunicorn with the port
os.execvp('gunicorn', [
    'gunicorn',
    '--bind', f'0.0.0.0:{port}',
    '--workers', '2',
    '--timeout', '120',
    'app.app:app'
])
