## Worklog Lite — documents + tasks, locally

Download **WorklogLite.exe**, double-click, and create your local account. The app opens in your default browser; keep its small launcher window open. No separate Python installation is required.

- Empty workspace: no sample documents, company records or default password.
- Confluence-inspired document spaces, hierarchy, Markdown editor, versions and attachments.
- Jira-inspired issues, backlog, drag-and-drop board, priority/due dates and document links.
- Local SQLite storage, login, backup/restore and portable exports.

Data stays in `%LOCALAPPDATA%\WorklogLite`; it is not synced to GitHub. This is a single-user Windows x64 app, not a cloud collaboration service. The executable is unsigned.

The build runs source tests and the **actual packaged EXE** against a temporary workspace before publishing. `smoke-report.json` records the checks and `SHA256SUMS.txt` provides the executable checksum. The ZIP includes Korean and English instructions.
