"""MCP server exposing DTEK shutdown data via tools & resources."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from mcp_dtek_shutdowns.config import settings
from mcp_dtek_shutdowns.db import close_pool, get_pool

logger = logging.getLogger(settings.server_name)

# ---------------------------------------------------------------------------
# Server instance
# ---------------------------------------------------------------------------
app = Server(settings.server_name)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------
@app.list_tools()
async def list_tools() -> list[Tool]:
    """Advertise available tools."""
    return [
        Tool(
            name="get_shutdowns",
            description="Query power shutdowns. Optionally filter by region, city, type, or date range.",
            inputSchema={
                "type": "object",
                "properties": {
                    "region": {"type": "string", "description": "Filter by region name (case-insensitive substring match)."},
                    "city": {"type": "string", "description": "Filter by city name."},
                    "shutdown_type": {
                        "type": "string",
                        "enum": ["planned", "emergency"],
                        "description": "Type of shutdown.",
                    },
                    "start_after": {"type": "string", "format": "date-time", "description": "ISO-8601 lower bound for start_time."},
                    "start_before": {"type": "string", "format": "date-time", "description": "ISO-8601 upper bound for start_time."},
                    "limit": {"type": "integer", "description": "Max rows to return (default 50, max 200)."},
                },
                "additionalProperties": False,
            },
        ),
        Tool(
            name="get_shutdown_by_id",
            description="Get a single shutdown record by its ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {"type": "integer", "description": "Shutdown record ID."},
                },
                "required": ["id"],
                "additionalProperties": False,
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:  # type: ignore[type-arg]
    """Dispatch tool calls."""
    pool = await get_pool()

    if name == "get_shutdowns":
        return await _handle_get_shutdowns(pool, arguments)
    if name == "get_shutdown_by_id":
        return await _handle_get_shutdown_by_id(pool, arguments)

    return [TextContent(type="text", text=f"Unknown tool: {name}")]


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------
async def _handle_get_shutdowns(pool, arguments: dict) -> list[TextContent]:  # type: ignore[type-arg]
    """Build a dynamic query and return matching shutdowns."""
    conditions: list[str] = []
    params: list[object] = []
    idx = 1

    if region := arguments.get("region"):
        conditions.append(f"region ILIKE ${idx}")
        params.append(f"%{region}%")
        idx += 1

    if city := arguments.get("city"):
        conditions.append(f"city ILIKE ${idx}")
        params.append(f"%{city}%")
        idx += 1

    if shutdown_type := arguments.get("shutdown_type"):
        conditions.append(f"shutdown_type = ${idx}")
        params.append(shutdown_type)
        idx += 1

    if start_after := arguments.get("start_after"):
        conditions.append(f"start_time >= ${idx}")
        params.append(datetime.fromisoformat(start_after))
        idx += 1

    if start_before := arguments.get("start_before"):
        conditions.append(f"start_time <= ${idx}")
        params.append(datetime.fromisoformat(start_before))
        idx += 1

    limit = min(int(arguments.get("limit", 50)), 200)

    query = "SELECT * FROM shutdowns"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += f" ORDER BY start_time DESC LIMIT ${idx}"
    params.append(limit)

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    results = [dict(r) for r in rows]
    return [TextContent(type="text", text=json.dumps(results, default=str))]


async def _handle_get_shutdown_by_id(pool, arguments: dict) -> list[TextContent]:  # type: ignore[type-arg]
    """Fetch a single shutdown by primary key."""
    shutdown_id = arguments["id"]
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM shutdowns WHERE id = $1", shutdown_id)

    if row is None:
        return [TextContent(type="text", text=f"No shutdown found with id={shutdown_id}")]

    return [TextContent(type="text", text=json.dumps(dict(row), default=str))]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> None:
    """Run the MCP server over stdio."""
    logging.basicConfig(level=settings.log_level)

    async def _run() -> None:
        async with stdio_server() as (read_stream, write_stream):
            try:
                await app.run(read_stream, write_stream, app.create_initialization_options())
            finally:
                await close_pool()

    asyncio.run(_run())


if __name__ == "__main__":
    main()
