# Disaster recovery

1. Snapshot persistent disk daily
2. Provision replacement VM from Terraform
3. Attach/restore disk to `/opt/data`
4. Start pinned Hermes image + Runtime Gateway + cloudflared
5. Load secrets from Secret Manager
6. Health check profiles
7. Reconcile AgentRuntimeBindings
8. Smoke run Runtime Smoke Test agent

Never share staging disk with production.
