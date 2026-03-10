# mcp-dtek-shutdowns

MCP server that exposes DTEK power shutdown data from a PostgreSQL database.

## Project structure

```
src/mcp_dtek_shutdowns/
  __init__.py        # package marker
  config.py          # pydantic-settings config from env vars
  db.py              # asyncpg connection pool
  models.py          # SQLAlchemy ORM models (used by Alembic)
  server.py          # MCP server with tools
alembic/             # database migrations
docker-compose.yml   # Postgres + MCP server
```

## Quick start

```bash
# 1. Start Postgres
docker compose up -d db

# 2. Install the project
pip install -e ".[dev]"

# 3. Copy and edit env
cp .env.example .env

# 4. Run migrations
alembic upgrade head

# 5. Run the MCP server
mcp-dtek-shutdowns
```

## Available MCP tools

| Tool | Description |
|---|---|
| `get_shutdowns` | Query shutdowns with optional filters (region, city, type, date range) |
| `get_shutdown_by_id` | Fetch a single shutdown record by ID |

## Migrations

```bash
# Generate a new migration after model changes
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```
