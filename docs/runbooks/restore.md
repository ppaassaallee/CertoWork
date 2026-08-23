# Restore Firestore from a scheduled export

## Backup

Exports go to the GCS bucket in `FIRESTORE_BACKUP_BUCKET`.

```bash
# One-off export (requires gcloud auth and firebase-tools)
gcloud firestore export gs://$FIRESTORE_BACKUP_BUCKET/$(date -u +%Y%m%dT%H%M%SZ) \
  --project="$FIREBASE_PROJECT_ID" \
  --database="$FIREBASE_DATABASE_ID"
```

Schedule this with Cloud Scheduler + a service account that can run `datastore.databases.export` / Firestore export.

## Restore

1. Identify the export prefix in the bucket (the folder that contains `all_namespaces/`).
2. Restore into a **new** database first, never over production:

```bash
gcloud firestore import gs://$FIRESTORE_BACKUP_BUCKET/<export-id> \
  --project="$FIREBASE_PROJECT_ID" \
  --database="$FIREBASE_DATABASE_ID-restore"
```

3. Verify collection counts and a sample of `projects`, `tasks`, and `workspace_members`.
4. Only after verification, import into the production database id or swap the client config.

Restores overwrite matching documents. There is no undo. Keep the previous export until the restored app is confirmed healthy.
