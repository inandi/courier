<div align="center">
  <h1>Courier [Beta]</h1>
  <p><strong>Ship GitHub Issues and Jira Tickets from Markdown — Without Leaving VS Code</strong></p>
</div>

Tired of switching between your editor, browser, and project management tool just to log a task? `Courier` lets you write draft tasks as plain `.md` files and ship them directly to GitHub or Jira with a single command — no copy-pasting, no context switching, no browser required.

## What is Courier?

`Courier` is a VS Code extension that turns your Markdown draft files into real GitHub issues or Jira tickets. Write your task in a `.md` file, confirm in a QuickPick, and Courier creates the issue in the background while you stay in your editor.

## Why Use Courier?

- **Stay in Flow**: Create issues and tickets without ever opening a browser tab
- **Bulk Shipping**: Select a whole folder of drafts and ship them all at once
- **Confirmation First**: A multi-select QuickPick always shows you exactly which files will be shipped — deselect anything you're not ready for
- **Rich Metadata**: Embed labels, assignees, priority, project keys, and issue types directly inside your `.md` files using a simple frontmatter block
- **Safe by Design**: Shipped files are automatically archived to prevent double-posting — the same file can never be shipped twice
- **No Extra Tools**: GitHub uses VS Code's built-in OAuth — no CLI or personal access token required to get started
- **Jira Ready**: Full Jira Cloud support with live project and issue type pickers backed by the Jira REST API

## Getting Started

### Installation

1. Open VS Code or Cursor
2. Go to the Extensions view
3. Search for **Courier**
4. Click Install

### GitHub Setup

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run **Courier: Sign in to GitHub**
3. VS Code will prompt you to authenticate via GitHub OAuth — no token needed
4. Alternatively, enter a Personal Access Token with `repo` scope when prompted

### Jira Setup

1. Create a Jira API token at [id.atlassian.com → Security → API tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Run **Courier: Configure Jira** from the Command Palette
3. Enter your Jira Cloud URL (e.g. `https://mycompany.atlassian.net`), email address, and API token
4. Courier validates the credentials immediately and stores them securely in VS Code SecretStorage

### First Ship

1. Create a `.md` file in your workspace with the issue title on line 1 and description below
2. Right-click the file in the Explorer panel
3. Select **Courier: Ship to GitHub** or **Courier: Ship to Jira**
4. Confirm the file in the QuickPick and press Enter
5. Watch the status bar spinner — your issue or ticket is live in seconds

## How It Works

### The File Format

Courier uses a simple **LineOne** format by default — no special syntax required:

```md
Fix login redirect loop

Users are stuck in a redirect when the session expires.
Repro: log out, then visit /dashboard.
Expected: redirect to login page.
```

- **Line 1** — becomes the issue title / ticket summary
- **Line 2 onwards** — becomes the body / description

### Frontmatter Metadata (Optional)

Add a `---` block at the very top of the file to attach metadata. All fields are optional and both GitHub and Jira fields can coexist in one file:

```md
---
labels: bug, needs-triage
assignees: alice
milestone: 3
project: PROJ
issuetype: Story
priority: High
---

Fix login redirect loop

Users are stuck in a redirect when the session expires.
```

| Field | Platform | Description |
|---|---|---|
| `labels` | GitHub + Jira | Comma-separated label names |
| `assignees` / `assignee` | GitHub (username) / Jira (email) | Comma-separated, Jira uses the first entry |
| `milestone` | GitHub | Milestone number (integer) |
| `project` | Jira | Project key, e.g. `PROJ` |
| `issuetype` / `type` | Jira | Issue type name, e.g. `Story`, `Bug`, `Task` |
| `priority` | Jira | Priority name, e.g. `High`, `Medium`, `Low` |

### What Happens Under the Hood

When you run a Courier ship command:

1. **Scan**: Finds all `.md` files in the selected folder using the configured glob pattern
2. **Confirm**: Shows a multi-select QuickPick with every file pre-ticked — deselect what you want to skip
3. **Authenticate**: Retrieves your GitHub OAuth token or Jira credentials from secure storage
4. **Resolve**: For Jira, resolves project key and issue type from frontmatter, settings, or a live QuickPick
5. **Parse**: Strips the frontmatter block, reads line 1 as title, remaining lines as body
6. **Ship**: Creates the issue or ticket via the GitHub REST API (Octokit) or Jira Cloud REST API v2
7. **Archive**: Moves the file to `_courier_processed/<timestamp>/` and writes a `.meta.json` sidecar with the issue URL
8. **Report**: Shows a summary notification with issue numbers/keys and an "Open in Browser" button

### The Archive

```
your-workspace/
└── _courier_processed/
    └── 2026-03-22T14-30-00/
        ├── fix-login.md
        └── fix-login.md.meta.json   ← { "source": "...", "issueUrl": "..." }
```

Archived files are never re-shipped. If a file is already inside `_courier_processed/`, Courier skips it with an "Already shipped" message.

### Project Templates

Place a `courier.template.json` (or `.vscode/courier.template.json`) in your workspace root to set a project-level default:

```json
{ "type": "lineOne", "titleLine": 1, "bodyFrom": 2 }
```

## Commands

### GitHub

| Command | Description |
|---|---|
| **Courier: Ship Folder to GitHub** | Scan folder for `.md` files, confirm, create GitHub issues |
| **Courier: Ship Selected Files to GitHub** | Pick `.md` files via dialog, confirm, create GitHub issues |
| **Courier: Ship to GitHub** | Right-click a `.md` file in the Explorer |
| **Courier: Sign in to GitHub** | Authenticate via VS Code OAuth or store a Personal Access Token |

### Jira

| Command | Description |
|---|---|
| **Courier: Ship Folder to Jira** | Scan folder for `.md` files, confirm, create Jira tickets |
| **Courier: Ship Selected Files to Jira** | Pick `.md` files via dialog, confirm, create Jira tickets |
| **Courier: Ship to Jira** | Right-click a `.md` file in the Explorer |
| **Courier: Configure Jira** | Set up Jira base URL, email, and API token |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `courier.sourceFolder` | `""` | Sub-folder to scan when using folder commands (e.g. `drafts`) |
| `courier.archiveFolder` | `_courier_processed` | Where shipped files are moved after success |
| `courier.filePattern` | `**/*.md` | Glob pattern for draft file discovery |
| `courier.github.repo` | `""` | Hard-code a target repo (`owner/repo`) — leave empty to auto-detect from `.git/config` |
| `courier.jira.baseUrl` | `""` | Jira Cloud URL, e.g. `https://mycompany.atlassian.net` |
| `courier.jira.defaultProject` | `""` | Default Jira project key — leave empty to be prompted per run |
| `courier.jira.defaultIssueType` | `"Task"` | Default Jira issue type — leave empty to be prompted per run |

## Tips & Tricks

- **Use a `drafts/` folder**: Set `courier.sourceFolder` to `drafts` and keep all your task drafts in one place — run "Ship Folder" to flush them all at once
- **Mix targets in one batch**: Some files can have `project: PROJ` (Jira) while others have GitHub labels — run each platform's ship command independently
- **Override per file**: Even if a `defaultProject` is set, a `project:` line in the frontmatter overrides it for that specific file
- **Safe to retry**: If a ship fails mid-batch (e.g. network error), only the successful files are archived — rerun the command and it picks up exactly where it left off
- **Check the meta file**: Each `.meta.json` sidecar stores the original path and issue URL — useful for tracing which draft became which issue

## Development

```bash
npm install
npm run compile    # compile TypeScript → out/
npm run watch      # incremental watch mode
npm test           # run unit tests (51 tests)
```

Press **F5** in VS Code to launch the Extension Development Host. See `_doc/PROCESS.md` for the full development guide and `_doc/TECHNICAL.md` for architecture details.

## Support the Project

If Courier has made your workflow easier, consider supporting (No Pressure):

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/igobinda)

## Need Help?

- **Issues**: Found a bug or have a feature request? Open an issue on GitHub
- **Repository**: [github.com/inandi/courier](https://github.com/inandi/courier)

## License

This project is licensed under the MIT License — feel free to use it however you'd like!

---

**Made with ❤️ by Gobinda Nandi**
