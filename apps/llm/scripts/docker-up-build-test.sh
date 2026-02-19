#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

# Load .env if present
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required (docker compose)."
  exit 1
fi

KEEP_RUNNING="${KEEP_RUNNING:-0}"
API_URL="${API_URL:-http://localhost:3001}"

cleanup() {
  if [ "$KEEP_RUNNING" = "1" ]; then
    echo "KEEP_RUNNING=1 set; leaving containers running."
    return 0
  fi
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "Building and starting containers..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "Waiting for service health at $API_URL/api/health ..."
ATTEMPTS=30
until curl -fsS "$API_URL/api/health" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS - 1))
  if [ $ATTEMPTS -le 0 ]; then
    echo "Service did not become healthy in time."
    docker compose -f "$COMPOSE_FILE" ps
    exit 1
  fi
  sleep 2
done

echo "Checking templates endpoint..."
TEMPLATES=$(curl -fsS "$API_URL/api/prompt/templates")
if ! echo "$TEMPLATES" | grep -q "templates"; then
  echo "Templates endpoint failed."
  echo "$TEMPLATES"
  exit 1
fi

echo "Docker smoke test passed."

if [ -n "${GEMINI_API_KEY:-}" ]; then
  echo "Running integration test..."
  bash "$ROOT_DIR/scripts/integration-test.sh"
else
  echo "GEMINI_API_KEY is not set; skipping integration test."
  echo "(Smoke test passed; set GEMINI_API_KEY in $ROOT_DIR/.env to enable integration.)"
fi

echo "All docker checks completed."
