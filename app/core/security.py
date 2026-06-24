# Provides minimal API key protection for administrative endpoints.

from fastapi import Header, HTTPException, status

from app.core.config import settings


def verify_admin_api_key(
    x_admin_api_key: str | None = Header(default=None, alias="X-Admin-Api-Key"),
) -> bool:
    """Verify the admin API key from the X-Admin-Api-Key header."""
    if not settings.admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin API key is not configured",
        )

    if x_admin_api_key != settings.admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin API key",
        )

    return True
