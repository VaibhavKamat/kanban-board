#!/bin/sh
set -e

cd "$(dirname "$0")/.."

IMAGE_NAME=kanban-app
CONTAINER_NAME=kanban-app
PORT=8000

docker build -t "$IMAGE_NAME" .
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER_NAME" -p "$PORT:8000" --env-file .env "$IMAGE_NAME"

echo "Kanban app running at http://localhost:$PORT"
