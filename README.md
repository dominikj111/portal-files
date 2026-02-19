# Portal Files

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES5-blue)](https://www.typescriptlang.org/)

A local file server with a web-based UI for browsing, uploading, editing, and downloading files. **Specifically designed for legacy browsers** including Safari on iPad 4 (iOS 10.3.3) and Internet Explorer 11.

## Features

- 📂 **File Browser** — Navigate directories with breadcrumb UI
- 📥 **Download** — Direct file downloads
- 📤 **Upload** — Multi-file upload with progress tracking
- ✏️ **Text Editor** — Create and edit text files (.txt, .md, .js, .php, etc.)
- 👁️ **File Viewer** — Read-only viewer with markdown preview for .md files
- 📝 **Markdown Preview** — Live HTML preview for markdown files
- 🗑️ **Delete** — Remove files and empty directories
- 📁 **Create Folders** — New directory creation
- ▶️ **VLC Integration** — Open media files in VLC via custom URL scheme
- 🎮 **Tetris** — Built-in game (because why not?)
- 🐛 **Debug Panel** — Remote error inspection via on-screen console
- 📱 **Touch-Optimized** — Tablet and mobile-friendly interface
- 🔒 **Security** — Path traversal protection with `safe_join` and `secure_filename`

## Why This Project?

Several file browser web apps exist ([filebrowser/filebrowser](https://github.com/filebrowser/filebrowser), [mickael-kerjean/filestash](https://github.com/mickael-kerjean/filestash)), but **none target legacy browsers** like Safari on iOS 10.3.3 or IE11. This project compiles TypeScript to ES5, uses XMLHttpRequest instead of fetch, and avoids modern CSS features (no Grid, prefixed Flexbox) to ensure compatibility with older devices.

Originally created to solve iPad 4 → Mac file transfer issues.

## Prerequisites

- [Miniconda](https://docs.conda.io/en/latest/miniconda.html) or Anaconda
- [Node.js](https://nodejs.org/) (v18+ with pnpm for build tools)

## Setup

### 1. Python Environment

```bash
# Create and activate the conda environment
conda env create -f environment.yml
conda activate portal_files
```

### 2. Frontend Build

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Install Node.js dependencies
pnpm install

# Build the frontend (TypeScript → ES5 JavaScript)
pnpm run build
```

### 3. Run the Server

```bash
# Serve files from the ./files directory (default)
python run.py

# Serve files from a specific directory
python run.py --root /path/to/files

# Custom host and port
python run.py --host 0.0.0.0 --port 8081
```

Open your browser and navigate to `http://localhost:8081`.

## Development

### Frontend Development

```bash
# Watch mode — automatically rebuilds on changes
pnpm run watch

# Lint TypeScript code
pnpm run lint

# Fix lint issues
pnpm run lint:fix

# Format code with Prettier
pnpm run format

# Check formatting
pnpm run format:check
```

### Python Linting

```bash
# Lint Python code with ruff
ruff check server/ run.py

# Format Python code
ruff format server/ run.py
```

### Configuration

The server can be configured via environment variables or CLI arguments:

| Variable            | CLI Flag  | Default   | Description             |
| ------------------- | --------- | --------- | ----------------------- |
| `PORTAL_FILES_ROOT` | `--root`  | `./files` | Root directory to serve |
| `PORTAL_HOST`       | `--host`  | `0.0.0.0` | Host to bind to         |
| `PORTAL_PORT`       | `--port`  | `8081`    | Port to listen on       |
| `PORTAL_DEBUG`      | `--debug` | `true`    | Enable debug mode       |

## Architecture

### Backend (Python / Flask)

- **`run.py`** — Entry point with CLI argument parsing
- **`server/app.py`** — Flask application factory
- **`server/config.py`** — Configuration management
- **`server/routes/api.py`** — File listing and download API
- **`server/routes/logging.py`** — Client-side error log receiver

### Frontend (TypeScript → ES5)

- **`src/main.ts`** — Application entry point
- **`src/api.ts`** — XHR-based API client
- **`src/navigation.ts`** — Hash-based client-side routing
- **`src/ui.ts`** — Main UI controller
- **`src/events.ts`** — Event bus (pub/sub) to break circular dependencies
- **`src/breadcrumb.ts`** — Breadcrumb navigation component
- **`src/file-list.ts`** — File listing component with view/edit/delete actions
- **`src/uploader.ts`** — Multi-file upload with progress tracking
- **`src/editor.ts`** — Text file editor with markdown preview
- **`src/viewer.ts`** — Read-only file viewer with markdown preview
- **`src/newfolder.ts`** — New directory creation dialog
- **`src/markdown.ts`** — Markdown-to-HTML parser
- **`src/tetris.ts`** — Self-contained Tetris game
- **`src/vlc.ts`** — VLC URL scheme integration
- **`src/error-logger.ts`** — Error capture and server reporting
- **`src/debug-panel.ts`** — On-screen debug console
- **`src/utils.ts`** — Utility functions
- **`src/types.ts`** — TypeScript type definitions

### API Endpoints

| Method   | Endpoint                  | Description                        |
| -------- | ------------------------- | ---------------------------------- |
| `GET`    | `/`                       | Serves the single-page application |
| `GET`    | `/api/files?path=<path>`  | Lists directory contents as JSON   |
| `GET`    | `/api/download/<path>`    | Downloads a file                   |
| `GET`    | `/api/read/<path>`        | Reads a text file (JSON response)  |
| `PUT`    | `/api/save/<path>`        | Saves a text file                  |
| `POST`   | `/api/upload?path=<path>` | Uploads one or more files          |
| `POST`   | `/api/create-file`        | Creates a new empty file           |
| `POST`   | `/api/create-directory`   | Creates a new directory            |
| `DELETE` | `/api/delete/<path>`      | Deletes a file or empty directory  |
| `POST`   | `/api/log`                | Receives client-side error logs    |

## Browser Compatibility

The frontend is compiled to ES5 and uses only APIs available in Safari on iOS 10:

- `XMLHttpRequest` instead of `fetch`
- Classical function expressions (no arrow functions in output)
- `var` declarations (no `let`/`const` in output)
- Prefixed CSS flexbox properties
- No CSS Grid
- No ES6 module syntax in output

## Debug Panel

A floating debug button (🐛) appears in the bottom-right corner of the page. Tapping it reveals an on-screen console that shows:

- Client-side errors and warnings
- Navigation events
- API request results

All debug messages are also sent to the server and logged to the terminal, allowing inspection even without access to the browser's developer tools.

## Progressive Web App (PWA)

This application can be installed as a PWA on modern browsers. However, **PWA requires HTTPS** to function properly.

Without HTTPS, the app will still work as a standard web page but won't have offline capabilities or installability.
