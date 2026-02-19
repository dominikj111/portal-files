"""Server configuration."""

import os

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_FILES_ROOT = os.path.join(_BASE_DIR, "files")


class Config:
    """Application configuration, overridable via environment variables."""

    FILES_ROOT: str = os.environ.get("PORTAL_FILES_ROOT", _DEFAULT_FILES_ROOT)
    HOST: str = os.environ.get("PORTAL_HOST", "0.0.0.0")
    PORT: int = int(os.environ.get("PORTAL_PORT", "8080"))
    DEBUG: bool = os.environ.get("PORTAL_DEBUG", "true").lower() == "true"
    LOG_CLIENT_ERRORS: bool = True

    # Files and extensions to hide from directory listings.
    # These are still served as static assets — they just don't appear in the browse UI.
    EXCLUDED_EXTENSIONS: set[str] = {".html", ".css", ".js", ".map", ".gitkeep"}
    EXCLUDED_FILENAMES: set[str] = {"index.html", ".gitkeep"}
