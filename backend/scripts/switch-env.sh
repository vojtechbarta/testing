#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: npm run env:use:local | npm run env:use:azure"
  exit 1
fi

PROFILE="$1"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_FILE="$ROOT_DIR/.env.$PROFILE"
TARGET_FILE="$ROOT_DIR/.env"

if [ ! -f "$SOURCE_FILE" ]; then
  echo "Missing $SOURCE_FILE"
  echo "Create it from .env.$PROFILE.example first."
  exit 1
fi

cp "$SOURCE_FILE" "$TARGET_FILE"
echo "Switched backend env to profile: $PROFILE"
echo "Active file: $TARGET_FILE"
