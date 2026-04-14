#!/usr/bin/env bash
# Use this script to start the LLVM service container for local development

# TO RUN ON WINDOWS:
# 1. Install WSL (Windows Subsystem for Linux) - https://learn.microsoft.com/en-us/windows/wsl/install
# 2. Install Docker Desktop or Podman Deskop
# - Docker Desktop for Windows - https://docs.docker.com/docker-for-windows/install/
# - Podman Desktop - https://podman.io/getting-started/installation
# 3. Open WSL - `wsl`
# 4. Run this script - `./start-llvm.sh`

# On Linux and macOS you can run this script directly - `./start-llvm.sh`

# import env variables from .env
set -a
source .env

LLVM_IMAGE_NAME="eng4701-llvm-service"
LLVM_CONTAINER_NAME="eng4701-llvm-service"
LLVM_DEFAULT_PORT=3001

# Use LLVM_SERVICE_URL from .env if present, otherwise default to 3001
if [ -n "$LLVM_SERVICE_URL" ]; then
  LLVM_PORT=$(echo "$LLVM_SERVICE_URL" | awk -F':' '{print $3}' | awk -F'/' '{print $1}')
else
  LLVM_PORT="$LLVM_DEFAULT_PORT"
fi

if ! [ -x "$(command -v docker)" ] && ! [ -x "$(command -v podman)" ]; then
  echo -e "Docker or Podman is not installed. Please install docker or podman and try again.\nDocker install guide: https://docs.docker.com/engine/install/\nPodman install guide: https://podman.io/getting-started/installation"
  exit 1
fi

# determine which container command to use
if [ -x "$(command -v docker)" ]; then
  DOCKER_CMD="docker"
elif [ -x "$(command -v podman)" ]; then
  DOCKER_CMD="podman"
fi

if ! $DOCKER_CMD info > /dev/null 2>&1; then
  echo "$DOCKER_CMD daemon is not running. Please start $DOCKER_CMD and try again."
  exit 1
fi

if $DOCKER_CMD container inspect "$LLVM_CONTAINER_NAME" >/dev/null 2>&1; then
  IS_RUNNING="$($DOCKER_CMD inspect -f '{{.State.Running}}' "$LLVM_CONTAINER_NAME" 2>/dev/null)"
  if [ "$IS_RUNNING" = "true" ]; then
    echo "LLVM service container '$LLVM_CONTAINER_NAME' already running"
    exit 0
  fi
fi

PORT_OWNER_CONTAINER="$($DOCKER_CMD ps -q -f publish=$LLVM_PORT)"
if [ -n "$PORT_OWNER_CONTAINER" ]; then
  PORT_OWNER_NAME="$($DOCKER_CMD ps --filter "id=$PORT_OWNER_CONTAINER" --format '{{.Names}}')"
  echo "Port $LLVM_PORT is already in use by container '${PORT_OWNER_NAME:-$PORT_OWNER_CONTAINER}'."
  echo "Stop that container and rerun this script."
  exit 1
fi

if command -v nc >/dev/null 2>&1; then
  if nc -z localhost "$LLVM_PORT" 2>/dev/null; then
    echo "Port $LLVM_PORT is already in use."
    exit 1
  fi
else
  echo "Warning: Unable to check if port $LLVM_PORT is already in use (netcat not installed)"
  read -p "Do you want to continue anyway? [y/N]: " -r REPLY
  if ! [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborting."
    exit 1
  fi
fi

if $DOCKER_CMD container inspect "$LLVM_CONTAINER_NAME" >/dev/null 2>&1; then
  if $DOCKER_CMD start "$LLVM_CONTAINER_NAME" >/dev/null; then
    echo "Existing LLVM service container '$LLVM_CONTAINER_NAME' started"
    exit 0
  else
    echo "Failed to start existing LLVM service container '$LLVM_CONTAINER_NAME'"
    exit 1
  fi
fi

if ! [ "$($DOCKER_CMD images -q $LLVM_IMAGE_NAME)" ]; then
  echo "LLVM image '$LLVM_IMAGE_NAME' not found. Building from dockerfile.llvm..."
  $DOCKER_CMD build -f dockerfile.llvm -t "$LLVM_IMAGE_NAME" . || {
    echo "Failed to build LLVM image '$LLVM_IMAGE_NAME'"
    exit 1
  }
fi

$DOCKER_CMD run -d \
  --name "$LLVM_CONTAINER_NAME" \
  -p "$LLVM_PORT":3001 \
  "$LLVM_IMAGE_NAME" && echo "LLVM service container '$LLVM_CONTAINER_NAME' was successfully created"
