# DB Migrations

Cloud SQL(PostgreSQL)向けの手動マイグレーション。

## 適用

```bash
export DATABASE_URL='postgres://...'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/db/migrations/0001_init.sql
```

## 再適用

`CREATE ... IF NOT EXISTS` で構成しているため、同一DDLは再適用可能。
本番では `backend/scripts/apply_migrations.sh` を利用する。
