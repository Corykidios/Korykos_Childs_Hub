import pytest

import app.core.config as config_mod
from app.services.memory import chroma_client


@pytest.fixture(autouse=True)
def isolated_dirs(tmp_path, monkeypatch):
    monkeypatch.setattr(config_mod.Config, "CHROMA_DATA_DIR", tmp_path / "chroma")
    monkeypatch.setattr(config_mod.Config, "SETTINGS_FILE", tmp_path / "settings.json")
    monkeypatch.setattr(
        config_mod.Config, "OBSIDIAN_AGENTS_DIR", tmp_path / "agents"
    )
    chroma_client.reset_singletons()
    yield
    chroma_client.reset_singletons()
