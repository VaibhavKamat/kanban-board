#!/bin/sh
set -e

CONTAINER_NAME=kanban-app

docker rm -f "$CONTAINER_NAME"
