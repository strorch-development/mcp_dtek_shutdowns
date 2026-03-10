"""Async database connection pool using asyncpg."""

import asyncpg
from asyncpg import Pool

from mcp_dtek_shutdowns.config import settings

_pool: Pool | None = None


def _parse_asyncpg_dsn() -> str:
    """Convert SQLAlchemy-style DSN to plain postgres:// for asyncpg."""
    dsn = settings.database_url
    if dsn.startswith("postgresql+asyncpg://"):
        dsn = dsn.replace("postgresql+asyncpg://", "postgresql://", 1)
    return dsn


async def get_pool() -> Pool:
    """Return the shared connection pool, creating it on first call."""
    global _pool  # noqa: PLW0603
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=_parse_asyncpg_dsn(),
            min_size=settings.db_pool_min_size,
            max_size=settings.db_pool_max_size,
        )
    return _pool


async def close_pool() -> None:
    """Gracefully close the connection pool."""
    global _pool  # noqa: PLW0603
    if _pool is not None:
        await _pool.close()
        _pool = None
