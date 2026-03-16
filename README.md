# Courier

Ship GitHub issues, Jira tickets, and Slack notifications directly from VS Code using Markdown (.md) files.

## Phase 1: GitHub (Current)

Create GitHub issues from .md files without leaving your editor.

### Format (LineOne)

- **Line 1** = Issue title
- **Line 2+** = Issue body

Example:

```md
Fix login redirect loop

Users are stuck in a redirect when session expires.
Repro: Log out, then visit /dashboard.
```

### Commands

- **Courier: Ship Folder to GitHub** — Ship all .md files in the workspace (or configured source folder)
- **Courier: Ship Selected Files to GitHub** — Pick .md files via file dialog
- **Courier: Ship to GitHub** — Right-click a .md file in the explorer
- **Courier: Configure GitHub Token** — Store a GitHub PAT (when gh CLI is not used)

### Setup

1. **Option A:** Install and authenticate [GitHub CLI](https://cli.github.com/) (`gh auth login`)
2. **Option B:** Run "Courier: Configure GitHub Token" and enter a Personal Access Token

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `courier.sourceFolder` | `""` | Default folder to scan (e.g. `drafts`) |
| `courier.archiveFolder` | `_courier_processed` | Where shipped files are moved |
| `courier.filePattern` | `**/*.md` | Glob for draft files |
| `courier.github.repo` | `""` | Override repo (owner/repo) |

### Project Templates

Place `courier.template.json` or `.vscode/courier.template.json` in your project:

```json
{ "type": "lineOne", "titleLine": 1, "bodyFrom": 2 }
```

## Development

```bash
npm install
npm run compile
```

Press F5 in VS Code to run the Extension Development Host.

## License

See [LICENSE](LICENSE).
