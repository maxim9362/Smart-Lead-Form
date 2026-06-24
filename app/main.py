# Creates the FastAPI application, initializes the database, and connects API routers.

from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.form import router as form_router
from app.api.health import router as health_router
from app.api.leads import router as leads_router
from app.core.config import settings
from app.core.init_db import init_db


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WIDGET_DIR = PROJECT_ROOT / "widget"
logger = logging.getLogger("uvicorn.error")


def log_startup_links() -> None:
    base_url = settings.public_base_url.rstrip("/")
    admin_url = f"{base_url}/api/leads?client_id={settings.default_client_id}"

    logger.info(
        "\n"
        "============================================================\n"
        "Smart Lead Form started\n"
        "\n"
        "Demo page:\n"
        "%s/widget/index.html\n"
        "\n"
        "Admin API URL:\n"
        "%s\n"
        "\n"
        "Admin API requires this header and will return 401 in a browser without it:\n"
        "X-Admin-Api-Key: <your-admin-api-key>\n"
        "\n"
        "PowerShell example:\n"
        "curl \"%s\" -H \"X-Admin-Api-Key: <your-admin-api-key>\"\n"
        "============================================================",
        base_url,
        admin_url,
        admin_url,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    log_startup_links()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(form_router)
app.include_router(leads_router)
app.mount("/widget", StaticFiles(directory=WIDGET_DIR, html=True), name="widget")
