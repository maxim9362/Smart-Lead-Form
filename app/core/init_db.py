# Initializes database tables for the MVP runtime.

from app.core.database import Base, engine
from app.models import FormSession, Lead


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
