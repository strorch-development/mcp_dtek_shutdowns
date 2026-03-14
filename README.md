# mcp_dtek_shutdowns

MCP server + scraper worker for DTEK Kremenchuk shutdowns page:

- Source: https://www.dtek-krem.com.ua/ua/shutdowns
- Storage: PostgreSQL
- Services:
  1) `scraper` worker (runs every 10 minutes) that fetches/updates data and stores snapshots in Postgres
  2) `mcp` server that reads from Postgres by address and returns the latest stored snapshot

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

### Notes

- The target website uses bot protection; the scraper uses Playwright (real Chromium) to fetch/render.
- MCP server is **stdio transport** (typical MCP). In Docker you usually run it on-demand:

```bash
docker compose run --rm mcp
```

## MCP tools

- `list_addresses(q?, limit?)`
- `get_shutdowns(address, limit?)` (returns latest stored snapshot; if multiple matches, best match is chosen)

## Development

- Scraper: `cd services/scraper && npm i && npm run dev`
- MCP: `cd services/mcp && npm i && npm run dev`
