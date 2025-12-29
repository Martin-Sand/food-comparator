# Scripts

This folder contains helper scripts that are **not part of normal deploys**.

## Source of truth

Database schema changes should be made via Alembic migrations:

- Create migration: `flask --app app.app:app db migrate -m "..."`
- Apply: `flask --app app.app:app db upgrade`

In Railway, deploys should run `flask --app app.app:app db upgrade` automatically.

## legacy/

Old one-off scripts that used `db.create_all()` or raw `ALTER TABLE` statements.
Kept only for reference; avoid using them going forward.
