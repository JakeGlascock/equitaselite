# Data recovery runbook

Treat this as the playbook for the worst-case scenarios. Production RDS is
in `us-east-1`, identifier `equitaselite-prod`. 35-day PITR is enabled and
backups + snapshots are encrypted with the RDS KMS key.

---

## Scenario 1 — A migration broke the schema (or wiped data)

**Symptom:** the migration task in a deploy succeeded but downstream code
crashes, or a row count dropped unexpectedly.

**Recovery: Point-in-Time Restore (PITR)** to a few seconds before the
migration started. Deploy logs include the migration task's launch time —
restore to ~5s before that timestamp.

```sh
# 1. Confirm the restorable window
aws rds describe-db-instances --db-instance-identifier equitaselite-prod \
  --query 'DBInstances[0].{Earliest:LatestRestorableTime,Retention:BackupRetentionPeriod}'

# 2. Restore to a new instance (uses the same KMS key automatically)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier equitaselite-prod \
  --target-db-instance-identifier equitaselite-prod-pitr-YYYYMMDDHHMM \
  --restore-time 2026-MM-DDTHH:MM:SSZ \
  --db-subnet-group-name equitaselite-prod \
  --vpc-security-group-ids <rds-sg-id> \
  --no-publicly-accessible

# 3. Wait until status = available
aws rds wait db-instance-available --db-instance-identifier equitaselite-prod-pitr-YYYYMMDDHHMM

# 4. Either:
#    a) Repoint the app at the new instance by editing infrastructure/ecs.tf's
#       DB_HOST env var or the SSM/Secrets reference, then redeploy — OR —
#    b) Rename: take the prod instance offline, rename old to *-old, rename
#       restored instance to equitaselite-prod (DNS stays the same).
```

Rename approach is faster (no app config change) but ~10 minutes of read-only
during the rename. PITR-restore-with-rename is the documented AWS pattern for
"restore in place".

---

## Scenario 2 — App is broken but the data is fine

**Symptom:** a recent deploy shipped a code bug that's crashing requests or
showing wrong data. Schema is intact.

**Recovery: roll the ECS service back to the previous task definition.**

```sh
# 1. Find the previous revision number
aws ecs describe-services --cluster equitaselite-prod --services equitaselite-prod \
  --query 'services[0].taskDefinition'
# Note the current revision, e.g. equitaselite-prod:42

# 2. List recent revisions
aws ecs list-task-definitions --family-prefix equitaselite-prod --sort DESC --max-items 5

# 3. Update the service to a known-good revision
aws ecs update-service \
  --cluster equitaselite-prod --service equitaselite-prod \
  --task-definition equitaselite-prod:<N>

# 4. Wait for it to roll
aws ecs wait services-stable --cluster equitaselite-prod --services equitaselite-prod
```

This is non-destructive — RDS is untouched.

---

## Scenario 3 — RDS instance is corrupted or unreachable

**Symptom:** RDS reports STORAGE_FULL, INCOMPATIBLE_RESTORE, or hardware
issue. Multi-AZ should have already failed over automatically.

**Recovery: restore from the most recent automated snapshot.**

```sh
# 1. List recent snapshots
aws rds describe-db-snapshots --db-instance-identifier equitaselite-prod \
  --snapshot-type automated --query 'reverse(sort_by(DBSnapshots, &SnapshotCreateTime))[:5].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
  --output table

# 2. Restore — same network config as the original
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier equitaselite-prod-restored \
  --db-snapshot-identifier <snapshot-id> \
  --db-subnet-group-name equitaselite-prod \
  --vpc-security-group-ids <rds-sg-id> \
  --no-publicly-accessible \
  --multi-az
```

Then follow Scenario 1's step 4 to swap traffic.

---

## Scenario 4 — Someone edited an already-applied migration

**Symptom:** the migration runner aborts the deploy with
`checksum mismatch for 00N_xxx.sql`.

**This is intentional.** Migration files are immutable once applied. Don't
"fix" the checksum — revert your edit and write a new migration that does
whatever schema change you needed:

```sh
# Bad: edit 008_add_membership.sql to also add an index
# Good: create 009_add_membership_index.sql with the new index
```

If you absolutely must overwrite history (only safe before the migration has
run anywhere), connect to RDS and delete the row:

```sql
DELETE FROM schema_migrations WHERE version = '00N_xxx.sql';
```

Then the next deploy treats it as pending again.

---

## What's covered automatically

- **Daily automated backups, 35-day retention** — every change in the last
  35 days is recoverable via PITR.
- **Multi-AZ failover** — if the primary AZ goes down, RDS promotes the
  standby. No manual intervention needed.
- **Storage encryption (KMS)** + **deletion protection: ON** — the instance
  can't be accidentally deleted via console/CLI without explicitly turning
  off the protection first.
- **`skip_final_snapshot = false`** — if it's ever destroyed, a final
  snapshot is taken first.

## What is not yet covered

- **Cross-region backups** — all snapshots live in us-east-1. If the entire
  region has a multi-hour outage, we have no off-region restore point.
- **Storage autoscaling** — allocated 100 GB is fixed. If it fills up,
  writes start failing. Set `max_allocated_storage` on the RDS resource.
- **Read-query audit logging** — pgaudit currently logs only writes + DDL,
  not SELECT. For a finance platform with PII, regulators may eventually
  want read audit too.
- **Migration runner runs as DB superuser** — a future migration with a
  destructive statement would execute without resistance. Long-term:
  create a `migrate_role` granted DDL but not `TRUNCATE` / `DROP TABLE`.
