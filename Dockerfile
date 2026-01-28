# syntax=docker/dockerfile:1

# Base image with Python 3.12
FROM python:3.12-slim AS base

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY requirements.txt ./

# Install dependencies.  Using --no-cache-dir to reduce layer size.
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code into the container
COPY . .

# Expose the port FastAPI will run on
EXPOSE 8000

# Run the application.  By default, we run Uvicorn to serve the FastAPI
# backend and frontend static files.  In development, you can add
# '--reload' to automatically reload on code changes.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]