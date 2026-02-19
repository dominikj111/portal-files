# CLAUDE.md

## Project Overview

**Portal Files** is a local file server with a web-based UI designed to browse, upload, edit, and
download files from a local machine over a network. The primary use case is accessing files from
an iPad 4 running iOS 10.3.3 (Safari), where modern web features are unavailable. This project
specifically targets **legacy browser compatibility** (Safari iOS 10, IE11) — a niche not covered
by existing file browser solutions.

## Project Goal

Provide a full-featured file manager (browse, upload, edit, delete, view) that works on older
browsers, with special attention to Safari on iOS 10 / iPad 4.

## Technology Stack

- **Backend**: Python 3.11+ with Flask
- **Frontend**: TypeScript compiled to ES5 vanilla JavaScript
- **Build**: Rollup bundler with TypeScript plugin
- **Linting**: ESLint with TypeScript support (frontend), ruff (backend)
- **Formatting**: Prettier (frontend), ruff (backend)
- **Package Management**: Conda (environment.yml) for Python, pnpm for Node.js

## Project Structure

```
portal_files/
├── run.py                    # Server entry point (CLI)
├── environment.yml           # Conda environment definition
├── package.json              # Node.js dependencies and scripts
├── tsconfig.json             # TypeScript configuration (target: ES5)
├── rollup.config.mjs         # Rollup bundler configuration
├── eslint.config.mjs         # ESLint flat configuration
├── pyproject.toml            # Python project metadata and ruff config
├── .prettierrc               # Prettier configuration
├── .prettierignore           # Prettier ignore patterns
├── .gitignore                # Git ignore patterns
├── README.md                 # User-facing documentation
├── CLAUDE.md                 # This file (architecture guide)
├── server/                   # Python Flask backend
│   ├── __init__.py
│   ├── app.py                # Flask app factory
│   ├── config.py             # Server configuration
│   └── routes/
│       ├── __init__.py
│       ├── api.py            # File operations (list, download, upload, edit, delete)
│       └── logging.py        # Client error log receiver
├── src/                      # TypeScript frontend source
│   ├── main.ts               # App initialisation
│   ├── types.ts              # Type definitions
│   ├── api.ts                # XHR API client (no fetch)
│   ├── navigation.ts         # Hash-based SPA routing
│   ├── ui.ts                 # Main UI controller
│   ├── events.ts             # Event bus (pub/sub) to break circular deps
│   ├── breadcrumb.ts         # Breadcrumb navigation
│   ├── file-list.ts          # File/folder list with view/edit/delete buttons
│   ├── uploader.ts           # Multi-file upload with progress tracking
│   ├── editor.ts             # Text file editor with markdown preview
│   ├── viewer.ts             # Read-only file viewer with markdown preview
│   ├── newfolder.ts          # New directory creation dialog
│   ├── markdown.ts           # Markdown-to-HTML parser
│   ├── tetris.ts             # Self-contained Tetris game
│   ├── vlc.ts                # VLC URL scheme support
│   ├── error-logger.ts       # Error capture → server logging
│   ├── debug-panel.ts        # On-screen debug overlay
│   └── utils.ts              # Formatting and helper utilities
└── static/                   # Static web assets
    ├── index.html            # Single page application shell
    ├── css/
    │   └── styles.css        # Touch-friendly responsive styles
    └── js/
        └── app.js            # Built output (generated, gitignored)
```

## Key Design Decisions

1. **ES5 Output** — TypeScript compiles to ES5 for Safari iOS 10 compatibility
2. **XMLHttpRequest** — Used instead of fetch API for broader browser support
3. **Hash-based Routing** — `window.location.hash` for SPA navigation (no History API dependency)
4. **IIFE Bundle** — Rollup outputs a single IIFE bundle, no module loader required
5. **Server-side Error Logging** — Client JS errors are sent to the server via `POST /api/log`
   since the iPad has no accessible dev tools
6. **Debug Panel** — On-screen error console (🐛 button) for visual debugging without dev tools
7. **VLC Integration** — `vlc://` URL scheme links for opening media files in VLC on iOS
8. **No Frameworks** — Pure vanilla DOM manipulation for minimal bundle size and maximum compat
9. **Prefixed CSS** — Webkit-prefixed flexbox properties for older Safari versions
10. **Event Bus Pattern** — `events.ts` provides pub/sub to break circular dependencies between
    `ui.ts` ↔ `file-list.ts` ↔ `editor.ts` ↔ `uploader.ts`
11. **Self-Contained Modules** — Each feature (uploader, editor, viewer, tetris) is a separate
    module with a single `init` or `open*` export to avoid coupling
12. **Path Security** — All file paths validated with `safe_join` and `secure_filename` to prevent
    directory traversal attacks

## API Contract

### GET /api/files?path=<path>

Returns JSON directory listing:

```json
{
  "path": "/current/path",
  "parent": "/parent/path",
  "entries": [
    {
      "name": "filename",
      "type": "file|directory",
      "size": 1234,
      "modified": "ISO-8601",
      "extension": "mp4",
      "editable": true
    }
  ]
}
```

### GET /api/download/<filepath>

Returns file as attachment download.

### GET /api/read/<filepath>

Returns text file contents as JSON:

```json
{
  "content": "file contents here"
}
```

### PUT /api/save/<filepath>

Saves text file. Request body: `{ "content": "..." }`

### POST /api/upload?path=<path>

Accepts multipart/form-data file upload. Returns JSON with uploaded file names.

### POST /api/create-file

Creates a new empty file. Request body: `{ "path": "/current/path", "fileName": "newfile.txt" }`

### POST /api/create-directory

Creates a new directory. Request body: `{ "path": "/current/path", "dirName": "newfolder" }`

### DELETE /api/delete/<filepath>

Deletes a file or empty directory. Returns JSON: `{ "status": "ok" }`

### POST /api/log

Accepts JSON client error logs:

```json
{
  "level": "error|warn|info|debug",
  "message": "Error description",
  "stack": "stack trace",
  "url": "source URL",
  "line": 0,
  "col": 0,
  "userAgent": "browser UA string",
  "timestamp": "ISO-8601"
}
```

## Development Commands

- `pnpm install` — Install Node.js dependencies
- `pnpm run build` — Build frontend (TypeScript → ES5 IIFE)
- `pnpm run watch` — Watch mode for development
- `pnpm run lint` — Run ESLint on TypeScript source
- `pnpm run format` — Format code with Prettier
- `conda env create -f environment.yml` — Create Python environment
- `conda activate portal_files` — Activate Python environment
- `python run.py --root ./files --port 8081` — Start server (default: ./files, port 8081)

## PWA Notes

This app can be converted to a Progressive Web App, but **PWA requires HTTPS**. For local use:

1. Set up a named domain in local DNS (e.g., `portal.local`)
2. Use a reverse proxy (nginx/Caddy) with self-signed cert or Let's Encrypt
3. Add `manifest.json` and service worker files
4. Generate icons (192x192, 512x512)

Without HTTPS, the app works as a standard web page but lacks offline/install capabilities.

## Coding Conventions

- **Python**: Follow PEP 8, use type hints, double quotes, 100 char line length (ruff)
- **TypeScript**: Strict mode, explicit return types, single quotes, 100 char line length
- **CSS**: BEM-like naming (`.block__element--modifier`), webkit prefixes for flexbox
- **Security**: All file paths validated against root directory to prevent traversal
