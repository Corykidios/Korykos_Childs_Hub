"""DuckDuckGoose configuration: paths and Flask basics ONLY.

LLM and embedding endpoints are deliberately NOT here — they are endpoint
profiles (app.core.profiles). Nothing is derived from anything.
"""

import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(_BACKEND_DIR.parent / ".env", override=False)


class Config:
    # Random per-process key when unset — no forgeable static default.
    # (Sessions reset on restart; set SECRET_KEY in .env to persist them.)
    SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
    DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    JSON_AS_ASCII = False
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB uploads

    DATA_DIR = Path(os.environ.get("DDG_DATA_DIR", _BACKEND_DIR / "data"))
    CHROMA_DATA_DIR = DATA_DIR / "chroma"
    SETTINGS_FILE = DATA_DIR / "settings.json"
    TASK_DB_PATH = DATA_DIR / "app.db"
    PROJECTS_DIR = DATA_DIR / "projects"
    OBSIDIAN_AGENTS_DIR = Path(
        os.environ.get("OBSIDIAN_AGENTS_DIR", DATA_DIR / "agents")
    )
