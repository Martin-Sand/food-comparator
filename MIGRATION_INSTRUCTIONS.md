# Database Migrations (Alembic)

This project uses Flask-Migrate/Alembic.

## The rule

- **Never** run one-off `ALTER TABLE ...` scripts.
- **Never** rely on `db.create_all()` in production.
- Always add an Alembic migration file and let deploys run `db upgrade`.

## Local workflow

```bash
# Create a migration from model changes
flask --app app.app:app db migrate -m "describe change"

# Apply locally
flask --app app.app:app db upgrade
```

Commit the generated file under `migrations/versions/`.

## Railway workflow

Deploys run migrations automatically via `start.sh`.

If you need to run manually in Railway shell:

```bash
flask --app app.app:app db upgrade
```
