FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Shell form (not exec-array form) so ${PORT} actually expands -- most PaaS
# hosts (Render, Railway, Fly, etc.) inject a dynamic $PORT and expect the
# app to bind to it. Falls back to 8000 for local/docker-compose use, where
# PORT isn't set.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}