#!/usr/bin/env bash
# Verify all Prisma migrations apply cleanly to an empty database (same idea as CI).
#
# Prerequisites: MySQL 8 reachable (e.g. `docker compose up -d` from repo root).
#
# Usage (from backend/): npm run prisma:migrate:verify
#
# Overrides:
#   PRISMA_MIGRATE_VERIFY_DATABASE_URL  If set, skip DB create/drop and run migrate against this URL only.
#   MIGRATE_VERIFY_DB_NAME              Database name to create/recreate (default: prisma_migrate_verify)
#   MIGRATE_VERIFY_HOST / PORT / USER / PASSWORD  Defaults match docker-compose.yaml (root/password @ 127.0.0.1:3306)
#
# If your MySQL password contains reserved URL characters, use PRISMA_MIGRATE_VERIFY_DATABASE_URL instead of PASSWORD.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"

DB_NAME="${MIGRATE_VERIFY_DB_NAME:-prisma_migrate_verify}"

HOST="${MIGRATE_VERIFY_HOST:-127.0.0.1}"
PORT="${MIGRATE_VERIFY_PORT:-3306}"
USER_NAME="${MIGRATE_VERIFY_USER:-root}"
PASSWORD="${MIGRATE_VERIFY_PASSWORD:-password}"

run_migrate() {
  local db_url="$1"
  (
    cd "$BACKEND_DIR"
    export DATABASE_URL="$db_url"
    npx prisma migrate deploy
    npx prisma migrate status
  )
}

if [[ -n "${PRISMA_MIGRATE_VERIFY_DATABASE_URL:-}" ]]; then
  echo "Using PRISMA_MIGRATE_VERIFY_DATABASE_URL (skipping DB recreate)."
  run_migrate "$PRISMA_MIGRATE_VERIFY_DATABASE_URL"
  exit 0
fi

# mysql://user:password@host:port/db — password must be URL-safe or use PRISMA_MIGRATE_VERIFY_DATABASE_URL
DATABASE_URL="mysql://${USER_NAME}:${PASSWORD}@${HOST}:${PORT}/${DB_NAME}"

mysql_cli_exec() {
  MYSQL_PWD="$PASSWORD" mysql -h "$HOST" -P "$PORT" -u "$USER_NAME" "$@"
}

docker_mysql_exec() {
  # Service name `db` matches docker-compose.yaml
  (cd "$REPO_ROOT" && docker compose exec -T db mysql -u"$USER_NAME" -p"$PASSWORD" "$@")
}

pick_runner() {
  if command -v mysql >/dev/null 2>&1; then
    RUNNER=cli
    return 0
  fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^ai-testing-shop-db$'; then
    RUNNER=docker
    return 0
  fi
  echo "Cannot connect to MySQL: install the mysql client, or start compose from repo root:" >&2
  echo "  docker compose up -d" >&2
  echo "Or set PRISMA_MIGRATE_VERIFY_DATABASE_URL to an empty database you manage yourself." >&2
  exit 1
}

wait_ready() {
  local i=0
  while (( i < 60 )); do
    if [[ "$RUNNER" == "cli" ]]; then
      if mysql_cli_exec -e "SELECT 1" >/dev/null 2>&1; then
        return 0
      fi
    else
      if docker_mysql_exec -e "SELECT 1" >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "MySQL not reachable at ${HOST}:${PORT} after 60s." >&2
  exit 1
}

run_sql() {
  local sql="$1"
  if [[ "$RUNNER" == "cli" ]]; then
    mysql_cli_exec -e "$sql"
  else
    docker_mysql_exec -e "$sql"
  fi
}

pick_runner
wait_ready

echo "Recreating database \"${DB_NAME}\" (DROP + CREATE)..."
SQL="$(printf 'DROP DATABASE IF EXISTS `%s`; CREATE DATABASE `%s`;' "$DB_NAME" "$DB_NAME")"
run_sql "$SQL"

echo "Applying migrations..."
run_migrate "$DATABASE_URL"
echo "OK: prisma migrate deploy + status succeeded against empty DB."
