"""Client-side error logging endpoint."""

import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

logging_bp = Blueprint("logging", __name__)

logger = logging.getLogger("portal_files.client")


@logging_bp.route("/log", methods=["POST"])
def client_log():
    """Receive and log a client-side error or diagnostic message."""
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"status": "error", "message": "Invalid JSON"}), 400

    level = data.get("level", "error").upper()
    message = data.get("message", "Unknown error")
    stack = data.get("stack", "")
    url = data.get("url", "")
    line = data.get("line", 0)
    col = data.get("col", 0)
    user_agent = data.get("userAgent", "")
    timestamp = data.get("timestamp", datetime.now(tz=timezone.utc).isoformat())

    log_message = (
        f"[CLIENT {level}] {timestamp}\n"
        f"  Message:    {message}\n"
        f"  URL:        {url} (line: {line}, col: {col})\n"
        f"  User-Agent: {user_agent}"
    )

    if stack:
        log_message += f"\n  Stack:\n    {stack}"

    log_level = getattr(logging, level, logging.ERROR)
    logger.log(log_level, log_message)

    return jsonify({"status": "ok"})
