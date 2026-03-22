# Courier

Ship GitHub issues and Jira tickets directly from VS Code using Markdown (.md) files.

## How it works

Write a `.md` file → run a Courier command → confirm the files in a QuickPick → tickets are created in the background with a status bar spinner. Shipped files are moved to an archive so they can never be double-posted.

---

## File format

### LineOne (default)

- **Line 1** — Issue/ticket title
- **Line 2+** — Body / description

```md
Fix login redirect loop

Users are stuck in a redirect when session expires.
Repro: Log out, then visit /dashboard.
```

### Frontmatter metadata (optional)

Add a `---` block at the top to send labels, assignees, project keys, and more:

```md
---
labels: bug, needs-triage
assignees: alice              (GitHub username or Jira email)
milestone: 3                  (GitHub milestone number)
project: PROJ                 (Jira project key)
issuetype: Story              (Jira issue type)
priority: High                (Jira priority)
---

Fix login redirect loop

Users are stuck in a redirect when session expires.
```

All fields are optional. GitHub and Jira fields can coexist in one file.

---

## GitHub (Phase 1)

### Commands

| Command | Description |
|---------|-------------|
| **Courier: Ship Folder to GitHub** | Find all .md files, confirm, create issues |
| **Courier: Ship Selected Files to GitHub** | Pick files via dialog, confirm, create issues |
| **Courier: Ship to GitHub** | Right-click a .md file in the explorer |
| **Courier: Sign in to GitHub** | Authenticate via VS Code GitHub OAuth or store a PAT |

### Setup

Run **Courier: Sign in to GitHub** from the Command Palette. VS Code prompts you to sign in with GitHub OAuth — no external tools required. Or enter a Personal Access Token (needs `repo` scope).

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `courier.github.repo` | `""` | Override repo (owner/repo) — leave empty to detect from `.git/config` |

---

## Jira (Phase 2)

### Commands

| Command | Description |
|---------|-------------|
| **Courier: Ship Folder to Jira** | Find all .md files, confirm, create tickets |
| **Courier: Ship Selected Files to Jira** | Pick files via dialog, confirm, create tickets |
| **Courier: Ship to Jira** | Right-click a .md file in the explorer |
| **Courier: Configure Jira** | Set up Jira base URL, email, and API token |

### Setup

1. Create a Jira API token at [id.atlassian.com → Security → API tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
2. Run **Courier: Configure Jira** from the Command Palette.
3. Enter your Jira Cloud URL (e.g. `https://mycompany.atlassian.net`), email, and API token.
4. Credentials are validated immediately and stored securely in VS Code SecretStorage.

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `courier.jira.baseUrl` | `""` | Jira Cloud URL (e.g. `https://mycompany.atlassian.net`) |
| `courier.jira.defaultProject` | `""` | Default project key — leave empty to pick per run |
| `courier.jira.defaultIssueType` | `"Task"` | Default issue type — leave empty to pick per run |

---

## Shared settings

| Setting | Default | Description |
|---------|---------|-------------|
| `courier.sourceFolder` | `""` | Default folder to scan (e.g. `drafts`) |
| `courier.archiveFolder` | `_courier_processed` | Where shipped files are moved after success |
| `courier.filePattern` | `**/*.md` | Glob for draft files |

---

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test          # run unit tests (51 tests)
```

Press F5 in VS Code to launch the Extension Development Host.

## License

See [LICENSE](LICENSE).
