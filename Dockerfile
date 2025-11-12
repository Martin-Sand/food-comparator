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

# Make start script executable
RUN chmod +x start.sh

# Create instance directory for SQLite (if nseeded)
RUN mkdir -p instance

# Set environment variables
ENV FLASK_APP=app/app.py
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Run the application using startup script
CMD ["./start.sh"]
