#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required (docker compose)."
  exit 1
fi

cleanup() {
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "Building and starting containers..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "Waiting for service health..."
ATTEMPTS=30
until curl -fsS "http://localhost:3001/api/health" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS - 1))
  if [ $ATTEMPTS -le 0 ]; then
    echo "Service did not become healthy in time."
    docker compose -f "$COMPOSE_FILE" ps
    exit 1
  fi
  sleep 2
done

echo "Checking templates endpoint..."
TEMPLATES=$(curl -fsS "http://localhost:3001/api/prompt/templates")
if ! echo "$TEMPLATES" | grep -q "templates"; then
  echo "Templates endpoint failed."
  echo "$TEMPLATES"
  exit 1
fi

echo "Docker smoke test passed."
