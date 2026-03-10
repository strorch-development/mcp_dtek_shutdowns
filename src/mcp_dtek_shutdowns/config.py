"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Server configuration."""

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/dtek_shutdowns"
    db_pool_min_size: int = 2
    db_pool_max_size: int = 10

    # Server
    server_name: str = "mcp-dtek-shutdowns"
    log_level: str = "INFO"

    model_config = {"env_prefix": "MCP_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
