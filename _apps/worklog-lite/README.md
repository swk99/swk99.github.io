# Worklog Lite

A lightweight, local-first hybrid of a documentation workspace and an issue board. Inspired by Confluence's pages/spaces and Jira's boards/backlogs; not an Atlassian product or integration.

**[Download the Windows x64 executable from Releases](https://github.com/swk99/swk99.github.io/releases)** · [한국어 사용 안내](README_KO.md)

## Run

Download `WorklogLite.exe`, double-click it, and create your local account in the browser that opens. No Python, Node.js, Docker, or database server installation is needed for the packaged executable. Keep the small launcher window open while using the app. Closing it stops the local server.

The workspace starts with one empty space and **zero documents or issues**. There are no default credentials, personal records, company documents, or connected accounts.

## Features

- Spaces, nested documents, Markdown editor and live preview, labels, search and favorites.
- Document versions, restore, optimistic concurrency, attachments and reversible trash.
- Task / Bug / Story issues with priority, status, assignee text, due dates, labels and history.
- Backlog and a drag-and-drop Kanban board: To do → In progress → In review → Done.
- Bidirectional context: link an issue to a document, or create an issue from a document.
- Full SQLite backup/restore and Markdown + issue JSON export.
- Local password login, logout, session expiry and throttled failed login attempts.

## Storage and access

The executable stores data under `%LOCALAPPDATA%\WorklogLite`. Saved pages, issues, versions and attachments live in `worklog.sqlite3`; credentials are separately hashed in `auth.json`. Runtime content is never pushed to GitHub. No runtime network calls are needed except to the app's IPv4 loopback server; external links only open when clicked.

This is a **single-user local application**. It is not a shared server, SSO service or encrypted database. A local user/process with direct access to the files may read or modify them. Do not expose the server through a tunnel or reverse proxy. The executable is currently unsigned.

Unsaved document drafts live in the current browser tab's sessionStorage; logout clears that workspace's drafts in the tab. Issue forms do not autosave. Always save before stopping the app.

## Recovery

Use the launcher or sidebar Backup action. Stop the app before restoring:

```powershell
.\WorklogLite.exe --restore "C:\Backups\worklog-lite-backup.sqlite3"
.\WorklogLite.exe --reset-login
```

Restore preserves the previous database as `before-restore-<id>.sqlite3` and does not change login settings. `auth.json` is separate from SQLite backups. The older Worklog Wiki v1 backup format is not a direct import format for this v2 database; use Markdown import for documents.

## Development

Python 3.11+ is sufficient for source/server use. `python desktop.py` also needs Tkinter. `python server.py` runs server-only using the source folder's `data/` directory.

```powershell
python -m unittest discover -s tests -v
node tests/test_renderer.cjs
python smoke_test.py
.\build-windows.ps1
```

GitHub Actions builds on Windows, runs the actual packaged executable's `--self-test` against a temporary workspace, and publishes the EXE, ZIP, checksum and smoke report only after success. Manual browser visual checks and HTTP integration checks complement each other; this is not a claim of full end-to-end UI automation.

The Markdown implementation is intentionally limited (headings, paragraphs, emphasis, code, simple lists/checklists/tables and safe links). There is no full rich-text editor, sprint/epic planning, JQL, multi-user collaboration or cloud synchronization.

Official design/API references are linked in [README_KO.md](README_KO.md).
