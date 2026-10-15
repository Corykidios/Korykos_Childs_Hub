"""DuckDuckGoose supervisor backend."""

from flask import Flask
from flask_cors import CORS

from app.core.config import Config


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    # Localhost-only origins: a single-operator local tool must not be
    # callable cross-site from arbitrary pages the operator has open.
    CORS(app, origins=[r"http://localhost:\d+", r"http://127\.0\.0\.1:\d+"])

    from app.api.settings import bp as settings_bp
    app.register_blueprint(settings_bp)

    from app.api.corpus import bp as corpus_bp
    app.register_blueprint(corpus_bp)

    from app.api.population import bp as population_bp
    app.register_blueprint(population_bp)

    from app.api.runs import bp as runs_bp
    app.register_blueprint(runs_bp)

    from app.api.reports import bp as reports_bp
    app.register_blueprint(reports_bp)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "app": "duckduckgoose"}

    return app
