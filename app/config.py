"""Environment-backed settings for local development and deployment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str
    access_token_expire_minutes: int
    cors_origins: list[str]
    attachments_dir: Path
    max_upload_bytes: int
    smtp_host: str | None
    smtp_port: int
    smtp_from: str | None
    smtp_user: str | None
    smtp_password: str | None
    smtp_use_tls: bool

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}


def load_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "development")
    jwt_secret_key = os.getenv("JWT_SECRET_KEY", "dev-only-change-me")
    if app_env.lower() in {"production", "prod"} and jwt_secret_key == "dev-only-change-me":
        raise RuntimeError("Set JWT_SECRET_KEY before running with APP_ENV=production")

    attachments_dir = Path(
        os.getenv(
            "ATTACHMENTS_DIR",
            str(Path(__file__).resolve().parents[1] / "uploaded_attachments"),
        )
    )
    return Settings(
        app_env=app_env,
        database_url=os.getenv("DATABASE_URL", "sqlite:///./mini_jira.db"),
        jwt_secret_key=jwt_secret_key,
        jwt_algorithm="HS256",
        access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720")),
        cors_origins=_split_csv(
            os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            )
        ),
        attachments_dir=attachments_dir,
        max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024))),
        smtp_host=os.getenv("SMTP_HOST") or None,
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        smtp_from=os.getenv("SMTP_FROM") or None,
        smtp_user=os.getenv("SMTP_USER") or None,
        smtp_password=os.getenv("SMTP_PASSWORD") or None,
        smtp_use_tls=os.getenv("SMTP_USE_TLS", "true").lower() != "false",
    )


settings = load_settings()
