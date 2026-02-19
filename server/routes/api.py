"""File listing, download, upload, and text-editing API routes."""

import mimetypes
import os
from datetime import datetime, timezone

from flask import Blueprint, abort, jsonify, request, send_file
from werkzeug.utils import secure_filename

from server.config import Config

api_bp = Blueprint("api", __name__)

# Extensions that the built-in editor can open
EDITABLE_EXTENSIONS = {
    ".txt", ".md", ".php", ".js", ".ts", ".css", ".html", ".htm",
    ".json", ".xml", ".yaml", ".yml", ".sh", ".py", ".cfg", ".conf",
    ".ini", ".log", ".csv", ".sql", ".env", ".toml", ".rb", ".go",
    ".java", ".c", ".h", ".cpp", ".rs", ".svelte", ".vue", ".jsx", ".tsx",
}


def safe_join(root: str, path: str) -> str:
    """Safely join root and path, preventing directory traversal attacks."""
    root = os.path.realpath(root)

    if path:
        full_path = os.path.realpath(os.path.join(root, path))
    else:
        full_path = root

    # Ensure the resolved path is within the root
    if not full_path.startswith(root):
        abort(403, description="Access denied: path traversal detected")

    return full_path


def get_file_info(full_path: str, name: str) -> dict:
    """Build a metadata dict for a file or directory entry."""
    stat = os.stat(full_path)
    is_dir = os.path.isdir(full_path)
    _, ext = os.path.splitext(name)

    extension = ext.lstrip(".").lower() if ext and not is_dir else None
    editable = ext.lower() in EDITABLE_EXTENSIONS if ext and not is_dir else False

    return {
        "name": name,
        "type": "directory" if is_dir else "file",
        "size": None if is_dir else stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "extension": extension,
        "editable": editable,
    }


@api_bp.route("/files")
def list_files():
    """List the contents of a directory as JSON."""
    rel_path = request.args.get("path", "")

    # Strip leading slash so os.path.join works correctly
    rel_path = rel_path.lstrip("/")

    full_path = safe_join(Config.FILES_ROOT, rel_path)

    if not os.path.exists(full_path):
        abort(404, description="Path not found")

    if not os.path.isdir(full_path):
        abort(400, description="Path is not a directory")

    entries: list[dict] = []
    try:
        for name in sorted(os.listdir(full_path)):
            # Skip hidden files and directories
            if name.startswith("."):
                continue

            # Skip excluded filenames
            if name in Config.EXCLUDED_FILENAMES:
                continue

            # Skip excluded extensions (for files, not directories)
            entry_path = os.path.join(full_path, name)
            if not os.path.isdir(entry_path):
                _, ext = os.path.splitext(name)
                if ext.lower() in Config.EXCLUDED_EXTENSIONS:
                    continue

            try:
                entries.append(get_file_info(entry_path, name))
            except OSError:
                # Skip files we cannot stat (broken symlinks, permission issues, etc.)
                continue
    except PermissionError:
        abort(403, description="Permission denied")

    # Directories first, then files; alphabetical within each group
    entries.sort(key=lambda e: (0 if e["type"] == "directory" else 1, e["name"].lower()))

    # Compute parent path
    parent = None
    if rel_path:
        parent_dir = os.path.dirname(rel_path)
        parent = "/" + parent_dir if parent_dir else "/"

    return jsonify(
        {
            "path": "/" + rel_path if rel_path else "/",
            "parent": parent,
            "entries": entries,
        }
    )


@api_bp.route("/download/<path:filepath>")
def download_file(filepath: str):
    """Download a single file."""
    full_path = safe_join(Config.FILES_ROOT, filepath)

    if not os.path.exists(full_path):
        abort(404, description="File not found")

    if os.path.isdir(full_path):
        abort(400, description="Cannot download a directory")

    mime_type, _ = mimetypes.guess_type(full_path)

    return send_file(
        full_path,
        mimetype=mime_type or "application/octet-stream",
        as_attachment=True,
        download_name=os.path.basename(full_path),
    )


@api_bp.route("/upload", methods=["POST"])
def upload_files():
    """Upload one or more files into a directory."""
    rel_path = request.form.get("path", "").lstrip("/")
    target_dir = safe_join(Config.FILES_ROOT, rel_path)

    if not os.path.isdir(target_dir):
        abort(400, description="Target directory does not exist")

    files = request.files.getlist("files")
    if not files:
        abort(400, description="No files provided")

    saved: list[str] = []
    for f in files:
        if not f.filename:
            continue
        filename = secure_filename(f.filename)
        if not filename:
            continue
        dest = os.path.join(target_dir, filename)
        f.save(dest)
        saved.append(filename)

    return jsonify({"status": "ok", "uploaded": saved})


@api_bp.route("/read/<path:filepath>")
def read_file(filepath: str):
    """Read the text contents of a file."""
    full_path = safe_join(Config.FILES_ROOT, filepath)

    if not os.path.exists(full_path):
        abort(404, description="File not found")

    if os.path.isdir(full_path):
        abort(400, description="Cannot read a directory")

    _, ext = os.path.splitext(full_path)
    if ext.lower() not in EDITABLE_EXTENSIONS:
        abort(400, description="File type is not editable")

    try:
        with open(full_path, encoding="utf-8", errors="replace") as fh:
            content = fh.read()
    except OSError as exc:
        abort(500, description=f"Failed to read file: {exc}")

    return jsonify({"path": filepath, "content": content})


@api_bp.route("/save/<path:filepath>", methods=["PUT"])
def save_file(filepath: str):
    """Save/overwrite the text contents of an existing file."""
    full_path = safe_join(Config.FILES_ROOT, filepath)

    if not os.path.exists(full_path):
        abort(404, description="File not found")

    if os.path.isdir(full_path):
        abort(400, description="Cannot write to a directory")

    _, ext = os.path.splitext(full_path)
    if ext.lower() not in EDITABLE_EXTENSIONS:
        abort(400, description="File type is not editable")

    data = request.get_json(silent=True)
    if data is None or "content" not in data:
        abort(400, description="Missing 'content' in request body")

    try:
        with open(full_path, "w", encoding="utf-8") as fh:
            fh.write(data["content"])
    except OSError as exc:
        abort(500, description=f"Failed to write file: {exc}")

    return jsonify({"status": "ok"})


@api_bp.route("/create-file", methods=["POST"])
def create_file():
    """Create a new text file in a directory."""
    data = request.get_json(silent=True)
    if not data:
        abort(400, description="Invalid JSON")

    rel_dir = data.get("path", "").lstrip("/")
    filename = data.get("filename", "").strip()
    content = data.get("content", "")

    if not filename:
        abort(400, description="Missing filename")

    filename = secure_filename(filename)
    if not filename:
        abort(400, description="Invalid filename")

    _, ext = os.path.splitext(filename)
    if ext.lower() not in EDITABLE_EXTENSIONS:
        abort(400, description="File type is not editable")

    target_dir = safe_join(Config.FILES_ROOT, rel_dir)
    if not os.path.isdir(target_dir):
        abort(400, description="Target directory does not exist")

    dest = os.path.join(target_dir, filename)
    if os.path.exists(dest):
        abort(409, description="File already exists")

    try:
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(content)
    except OSError as exc:
        abort(500, description=f"Failed to create file: {exc}")

    return jsonify({"status": "ok", "filename": filename})


@api_bp.route("/create-directory", methods=["POST"])
def create_directory():
    """Create a new directory."""
    data = request.get_json(silent=True)
    if not data:
        abort(400, description="Invalid JSON")

    rel_dir = data.get("path", "").lstrip("/")
    dirname = data.get("dirname", "").strip()

    if not dirname:
        abort(400, description="Missing directory name")

    dirname = secure_filename(dirname)
    if not dirname:
        abort(400, description="Invalid directory name")

    target_dir = safe_join(Config.FILES_ROOT, rel_dir)
    if not os.path.isdir(target_dir):
        abort(400, description="Parent directory does not exist")

    dest = os.path.join(target_dir, dirname)
    if os.path.exists(dest):
        abort(409, description="A file or directory with that name already exists")

    try:
        os.mkdir(dest)
    except OSError as exc:
        abort(500, description=f"Failed to create directory: {exc}")

    return jsonify({"status": "ok", "dirname": dirname})


@api_bp.route("/delete/<path:filepath>", methods=["DELETE"])
def delete_item(filepath: str):
    """Delete a file or empty directory."""
    full_path = safe_join(Config.FILES_ROOT, filepath)

    if not os.path.exists(full_path):
        abort(404, description="File or directory not found")

    try:
        if os.path.isdir(full_path):
            os.rmdir(full_path)  # Only removes empty directories
        else:
            os.remove(full_path)
    except OSError as exc:
        abort(500, description=f"Failed to delete: {exc}")

    return jsonify({"status": "ok"})
