# Use Python 3.10 slim image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies for Pillow and other packages
RUN apt-get update && apt-get install -y \
    gcc \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create instance directory for SQLite (if needed)
RUN mkdir -p instance

# Expose port
EXPOSE 5050

# Set environment variables
ENV FLASK_APP=app/app.py
ENV PYTHONUNBUFFERED=1

# Run the application using gunicorn for production
# Use sh -c to ensure $PORT variable expansion
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5050} --workers 2 --timeout 120 app.app:app"]
