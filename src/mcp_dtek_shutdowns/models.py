"""SQLAlchemy ORM models for Alembic migrations."""

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all ORM models."""


class Shutdown(Base):
    """A planned or emergency power shutdown record."""

    __tablename__ = "shutdowns"

    id: Mapped[int] = mapped_column(primary_key=True)
    region: Mapped[str] = mapped_column(String(255), index=True)
    city: Mapped[str] = mapped_column(String(255), index=True)
    street: Mapped[str | None] = mapped_column(String(512), nullable=True)
    shutdown_type: Mapped[str] = mapped_column(String(64), index=True)  # planned / emergency
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
