#!/usr/bin/env bash
# Create (or reuse) a GCE VM and run Chatwoot for certo.work.
# Requires an already-authenticated gcloud (Cloud Shell or local).
# This agent does not log into Google Cloud for you.
set -euo pipefail

PROJECT="${GCP_PROJECT:-gen-lang-client-0277783597}"
ZONE="${GCP_ZONE:-us-central1-a}"
INSTANCE="${GCP_INSTANCE:-certo-chatwoot}"
MACHINE="${GCP_MACHINE:-e2-standard-2}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
GCLOUD="${GCLOUD:-gcloud}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing command: $1" >&2
    exit 1
  }
}

need "$GCLOUD"

if ! "$GCLOUD" auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q '@'; then
  cat >&2 <<'EOF'
gcloud is not logged in.

Do this in Google Cloud Shell (recommended):
  1. Open https://shell.cloud.google.com/?project=gen-lang-client-0277783597
  2. Sign in as alejandro@getboldr.ai
  3. Clone or upload ops/chatwoot, then run: bash ops/chatwoot/deploy-gcp.sh

Or, to let this Cursor agent drive gcloud, complete the device login
it prints and paste the verification code back into the chat.
EOF
  exit 1
fi

echo "Using project $PROJECT zone $ZONE instance $INSTANCE"
"$GCLOUD" config set project "$PROJECT" >/dev/null
if ! "$GCLOUD" services enable compute.googleapis.com --project "$PROJECT"; then
  cat >&2 <<EOF
Could not enable Compute Engine. Link billing on this Firebase project:
https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT}
EOF
  exit 1
fi

if ! "$GCLOUD" compute firewall-rules describe allow-certo-chatwoot --project "$PROJECT" >/dev/null 2>&1; then
  "$GCLOUD" compute firewall-rules create allow-certo-chatwoot \
    --project "$PROJECT" \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:3000 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=certo-chatwoot \
    --description="Private Chatwoot origin fetched by the certo.work Worker"
fi

create_vm() {
  local family="$1"
  "$GCLOUD" compute instances create "$INSTANCE" \
    --project "$PROJECT" \
    --zone "$ZONE" \
    --machine-type "$MACHINE" \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-balanced \
    --image-family="$family" \
    --image-project=ubuntu-os-cloud \
    --tags=certo-chatwoot \
    --scopes=https://www.googleapis.com/auth/devstorage.read_only \
    --quiet
}

if ! "$GCLOUD" compute instances describe "$INSTANCE" --zone "$ZONE" --project "$PROJECT" >/dev/null 2>&1; then
  if ! create_vm ubuntu-2404-lts-amd64; then
    echo "Falling back to ubuntu-2204-lts"
    create_vm ubuntu-2204-lts
  fi
fi

ssh_cmd() {
  "$GCLOUD" compute ssh "$INSTANCE" \
    --project "$PROJECT" \
    --zone "$ZONE" \
    --ssh-flag="-o StrictHostKeyChecking=no" \
    --ssh-flag="-o UserKnownHostsFile=/dev/null" \
    --command "$1"
}

echo "Waiting for SSH..."
ok=0
for _ in $(seq 1 36); do
  if ssh_cmd "echo ready" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 8
done
if [[ "$ok" != 1 ]]; then
  echo "SSH to $INSTANCE never became ready" >&2
  exit 1
fi

"$GCLOUD" compute scp \
  --project "$PROJECT" \
  --zone "$ZONE" \
  "$ROOT/docker-compose.yml" \
  "$ROOT/docker-compose.gcp.yml" \
  "$ROOT/gcp-startup.sh" \
  "$ROOT/bootstrap.rb" \
  "$INSTANCE:/tmp/"

ssh_cmd "sudo mkdir -p /opt/chatwoot && sudo mv /tmp/docker-compose.yml /tmp/docker-compose.gcp.yml /tmp/gcp-startup.sh /tmp/bootstrap.rb /opt/chatwoot/ && sudo chmod +x /opt/chatwoot/gcp-startup.sh && sudo bash /opt/chatwoot/gcp-startup.sh"

echo "Waiting for Chatwoot on :3000..."
ok=0
for _ in $(seq 1 60); do
  if ssh_cmd "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ | grep -Eq '200|302|401|403'"; then
    ok=1
    break
  fi
  sleep 8
done
if [[ "$ok" != 1 ]]; then
  echo "Chatwoot did not start. Last compose status:" >&2
  ssh_cmd "cd /opt/chatwoot && sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml ps" || true
  exit 1
fi

echo "Bootstrapping Super Admin + Platform App..."
ssh_cmd "cd /opt/chatwoot && sudo docker cp /opt/chatwoot/bootstrap.rb \$(sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml ps -q rails):/tmp/bootstrap.rb"
SECRETS_JSON="$(ssh_cmd "cd /opt/chatwoot && sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml exec -T rails bundle exec rails runner /tmp/bootstrap.rb")"
if [[ "$SECRETS_JSON" != *"CHATWOOT_PLATFORM_TOKEN"* ]]; then
  echo "Bootstrap did not return a platform token:" >&2
  echo "$SECRETS_JSON" >&2
  exit 1
fi

IP="$("$GCLOUD" compute instances describe "$INSTANCE" --project "$PROJECT" --zone "$ZONE" --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"
URL="http://${IP}:3000"

echo "$SECRETS_JSON" > /tmp/certo-chatwoot-secrets.json
ACCOUNT_ID="$(python3 - <<'PY' || true
import json
raw=open("/tmp/certo-chatwoot-secrets.json").read()
start=raw.find("{")
end=raw.rfind("}")+1
print(json.loads(raw[start:end]).get("CHATWOOT_ACCOUNT_ID",""))
PY
)"
TOKEN="$(python3 - <<'PY' || true
import json
raw=open("/tmp/certo-chatwoot-secrets.json").read()
start=raw.find("{")
end=raw.rfind("}")+1
print(json.loads(raw[start:end]).get("CHATWOOT_PLATFORM_TOKEN",""))
PY
)"

cat <<EOF

Chatwoot origin (private to the Worker, not a product hostname):
  CHATWOOT_URL=${URL}
  CHATWOOT_ACCOUNT_ID=${ACCOUNT_ID}

Set on the certo.work Worker:
  npx wrangler secret put CHATWOOT_URL
  npx wrangler secret put CHATWOOT_PLATFORM_TOKEN
  npx wrangler secret put CHATWOOT_ACCOUNT_ID

Do not create collab.certo.work. FRONTEND_URL stays https://certo.work.

Bootstrap JSON also written to /tmp/certo-chatwoot-secrets.json
EOF
