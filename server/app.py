"""Flask application factory."""

import os

from flask import Flask, send_from_directory
from flask_cors import CORS

from server.config import Config


def create_app(config: object | None = None) -> Flask:
    """Create and configure the Flask application."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_dir = os.path.join(base_dir, "static")

    app = Flask(__name__, static_folder=static_dir, static_url_path="/static")

    if config:
        app.config.from_object(config)
    else:
        app.config.from_object(Config)

    CORS(app)

    # Register blueprints
    from server.routes.api import api_bp
    from server.routes.logging import logging_bp

    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(logging_bp, url_prefix="/api")

    @app.route("/")
    def index() -> str:
        """Serve the single-page application."""
        return send_from_directory(static_dir, "index.html")

    return app
