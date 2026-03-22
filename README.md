# Courier

Ship GitHub issues directly from VS Code using Markdown (.md) files.

## How it works

Write a `.md` file → run a Courier command → confirm the files → the issues appear on GitHub. Shipped files are moved to an archive so they can never be double-posted.

## File format

### LineOne (default)

- **Line 1** — Issue title
- **Line 2+** — Issue body

```md
Fix login redirect loop

Users are stuck in a redirect when session expires.
Repro: Log out, then visit /dashboard.
```

### Metadata (optional frontmatter)

Add a `---` block at the top to set labels, assignees, or a milestone:

```md
---
labels: bug, needs-triage
assignees: alice
milestone: 3
---

Fix login redirect loop

Users are stuck in a redirect when session expires.
```

All fields are optional. `milestone` must be the GitHub milestone number (integer).

## Commands

| Command | Description |
|---------|-------------|
| **Courier: Ship Folder to GitHub** | Find all .md files in the workspace (or `courier.sourceFolder`), confirm, ship |
| **Courier: Ship Selected Files to GitHub** | Pick .md files via the file dialog, confirm, ship |
| **Courier: Ship to GitHub** | Right-click a .md file in the explorer and ship it |
| **Courier: Sign in to GitHub** | Authenticate via VS Code GitHub OAuth or store a Personal Access Token |

## Setup

Run **Courier: Sign in to GitHub** from the Command Palette. VS Code will prompt you to sign in with GitHub OAuth — no external tools required. Alternatively enter a Personal Access Token (needs `repo` scope).

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `courier.sourceFolder` | `""` | Default folder to scan (e.g. `drafts`) |
| `courier.archiveFolder` | `_courier_processed` | Where shipped files are moved after success |
| `courier.filePattern` | `**/*.md` | Glob for draft files |
| `courier.github.repo` | `""` | Override repo (owner/repo) — leave empty to detect from `.git/config` |

## Project templates

Place `courier.template.json` or `.vscode/courier.template.json` in your project root:

```json
{ "type": "lineOne", "titleLine": 1, "bodyFrom": 2 }
```

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test          # run unit tests
```

Press F5 in VS Code to launch the Extension Development Host.

## License

See [LICENSE](LICENSE).
