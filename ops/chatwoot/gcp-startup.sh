#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y docker.io docker-compose-v2 openssl curl
systemctl enable --now docker

install -d -m 0755 /opt/chatwoot
cd /opt/chatwoot

if [[ ! -f /opt/chatwoot/.env ]]; then
  POSTGRES_PASSWORD="$(openssl rand -hex 18)"
  cat > /opt/chatwoot/.env <<EOF
SECRET_KEY_BASE=$(openssl rand -hex 64)
FRONTEND_URL=https://certo.work
FORCE_SSL=false
ENABLE_ACCOUNT_SIGNUP=false
DEFAULT_LOCALE=en
RAILS_ENV=production
NODE_ENV=production
INSTALLATION_ENV=docker
RAILS_LOG_TO_STDOUT=true
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DATABASE=chatwoot
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=
MAILER_SENDER_EMAIL=Certo Work <support@certo.work>
ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=$(openssl rand -hex 32)
ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=$(openssl rand -hex 32)
ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=$(openssl rand -hex 32)
EOF
fi

# Compose files are uploaded separately by the deploy script.
if [[ ! -f /opt/chatwoot/docker-compose.yml ]]; then
  echo "docker-compose.yml missing in /opt/chatwoot" >&2
  exit 1
fi

docker compose -f docker-compose.yml -f docker-compose.gcp.yml pull
docker compose -f docker-compose.yml -f docker-compose.gcp.yml up -d postgres redis
for _ in $(seq 1 30); do
  docker compose -f docker-compose.yml -f docker-compose.gcp.yml ps postgres | grep -q healthy && break
  sleep 4
done
docker compose -f docker-compose.yml -f docker-compose.gcp.yml run --rm rails bundle exec rails db:chatwoot_prepare
docker compose -f docker-compose.yml -f docker-compose.gcp.yml stop rails sidekiq || true
docker compose -f docker-compose.yml -f docker-compose.gcp.yml rm -f rails sidekiq || true
docker compose -f docker-compose.yml -f docker-compose.gcp.yml up -d --force-recreate --no-deps rails sidekiq
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null http://127.0.0.1:3000/; then
    break
  fi
  sleep 5
done
