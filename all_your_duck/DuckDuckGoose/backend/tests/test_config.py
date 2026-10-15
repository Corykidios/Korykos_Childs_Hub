import importlib


def test_dirs_are_under_backend_data(monkeypatch):
    monkeypatch.delenv("DDG_DATA_DIR", raising=False)
    import app.core.config as config
    importlib.reload(config)
    assert config.Config.DATA_DIR.name == "data"
    assert config.Config.CHROMA_DATA_DIR.parent == config.Config.DATA_DIR
    assert config.Config.SETTINGS_FILE.parent == config.Config.DATA_DIR
    assert config.Config.TASK_DB_PATH.parent == config.Config.DATA_DIR


def test_data_dir_overridable_by_env(monkeypatch, tmp_path):
    monkeypatch.setenv("DDG_DATA_DIR", str(tmp_path))
    import app.core.config as config
    importlib.reload(config)
    assert config.Config.DATA_DIR == tmp_path
    monkeypatch.delenv("DDG_DATA_DIR")
    importlib.reload(config)


def test_no_llm_settings_in_config():
    import app.core.config as config
    importlib.reload(config)
    forbidden = ("LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL_NAME", "OLLAMA_BASE_URL")
    for name in forbidden:
        assert not hasattr(config.Config, name)
