#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

# Load .env if present
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "GEMINI_API_KEY is not set. Add it to .env before running this test."
  exit 1
fi

API_URL="${API_URL:-http://localhost:3001}"

payload='{
  "template": "summarize-text",
  "input": {
    "text": "The quick brown fox jumps over the lazy dog. This is a simple test for summarization."
  },
  "parseJson": true,
  "cache": true
}'

response=$(curl -fsS -H "Content-Type: application/json" -d "$payload" "$API_URL/api/prompt/run")

echo "Response: $response"

# Basic validation
if ! echo "$response" | grep -q '"data"'; then
  echo "Integration test failed: missing data field."
  exit 1
fi

if ! echo "$response" | grep -q '"summary"'; then
  echo "Integration test failed: summary not found in response."
  exit 1
fi

echo "Integration test passed."
