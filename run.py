#!/usr/bin/env python3
"""Entry point for the Portal Files server."""

import argparse
import logging
import sys

from server.app import create_app
from server.config import Config


def main() -> None:
    """Parse CLI arguments and start the Flask server."""
    parser = argparse.ArgumentParser(description="Portal Files - Local file server")
    parser.add_argument(
        "--root",
        type=str,
        default=None,
        help="Root directory to serve files from (default: ~/)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default=None,
        help="Host to bind to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Port to listen on (default: 8080)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        default=None,
        help="Enable debug mode",
    )

    args = parser.parse_args()

    # Override config with CLI arguments
    if args.root is not None:
        Config.FILES_ROOT = args.root
    if args.host is not None:
        Config.HOST = args.host
    if args.port is not None:
        Config.PORT = args.port
    if args.debug is not None:
        Config.DEBUG = args.debug

    # Configure logging
    logging.basicConfig(
        level=logging.DEBUG if Config.DEBUG else logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )

    logger = logging.getLogger("portal_files")
    logger.info("Starting Portal Files server")
    logger.info("  Root directory: %s", Config.FILES_ROOT)
    logger.info("  Listening on:   %s:%d", Config.HOST, Config.PORT)

    app = create_app()
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)


if __name__ == "__main__":
    main()
