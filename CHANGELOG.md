# Release v1.1.5 - 2026-03-22

## Improvements
- Command Palette titles enhanced with VS Code codicons: `$(github)` for GitHub commands, `$(rocket)` for Jira commands, `$(key)` for sign-in, and `$(settings-gear)` for Jira configuration
- Extension package name updated to `inandi-courier` for VS Code Marketplace uniqueness, matching the `iNandi` publisher convention
- `package.json` enriched with `publisher`, `author` (name, email, URL), `repository`, and `icon` fields required for Marketplace publishing
- Context-menu group updated to `7_modification@100` / `7_modification@101` to align with VS Code's standard file-modification group ordering
- Full JSDoc documentation added across all 11 source files — every file, exported interface, and function now carries `@author`, `@since`, `@version`, `@copyright`, `@param`, and `@returns` tags
- Outdated phase-based spec documents removed from `_doc/`; replaced with comprehensive `doc/TECHNICAL.md` (architecture, modules, data flows, config, security, testing, build) and `doc/PROCESS.md` (dev setup, conventions, adding features, debugging, release checklist)
- README rewritten with a structured layout: problem/solution intro, getting started guides for GitHub and Jira, frontmatter examples, archive diagram, commands table, configuration reference, tips, and development section
- `.vscodeignore` added to exclude source, tests, and dev files from the packaged `.vsix`, keeping the published extension lean
- Jest + `ts-jest` test infrastructure added; 51 unit tests across 4 suites covering `parseLineOne`, `parseFrontmatter`, `parseGitHubRemoteUrl`, `normalizeBaseUrl`, and `buildIssueUrl`
- `@types/node` version style aligned to `20.x` to match project conventions

## Bug Fixes
- Fixed `Array.some()` used with an async callback in `shipToJira.ts` pre-scan — `some()` does not await Promises, so the predicate always evaluated to `true` (a resolved Promise is truthy), causing the project/issue-type QuickPick to always appear even when every file already specified its own `project:` in frontmatter. Replaced with `Promise.all` + a synchronous `some` check on the resolved drafts.

---

# Release v1.1.4 - 2026-03-22

## New Features

### GitHub Integration
- Ship `.md` draft files as GitHub issues directly from VS Code
- Three entry points: Ship Folder, Ship Selected Files, and right-click a file in the Explorer
- Authenticate via VS Code's built-in GitHub OAuth session (no CLI required)
- Personal Access Token (PAT) fallback stored securely in VS Code SecretStorage
- Auto-detect target repository from `.git/config` remote origin (supports HTTPS and SSH)
- Override target repository via `courier.github.repo` setting
- Issues created with title, body, labels, assignees, and milestone

### Jira Integration
- Ship `.md` draft files as Jira tickets directly from VS Code
- Three entry points: Ship Folder, Ship Selected Files, and right-click a file in the Explorer
- Basic Auth (email + API token) stored securely in VS Code SecretStorage
- Interactive credential setup with live validation before saving
- Project and issue type resolved once per batch via QuickPick (fetched live from Jira)
- Override defaults via `courier.jira.defaultProject` and `courier.jira.defaultIssueType` settings
- Tickets created with summary, description, labels, assignee, and priority

### Frontmatter Metadata Support
- Embed YAML-lite frontmatter in any `.md` file to attach metadata per-file
- GitHub fields: `labels`, `assignees`, `milestone`
- Jira fields: `project`, `issuetype`, `priority`
- Frontmatter is stripped before the issue body is parsed — never appears in the created issue
- Singular aliases accepted: `label`, `assignee`, `type`, `issue_type`

### LineOne Parse Format
- First non-empty line of the `.md` file becomes the issue title
- All remaining lines become the issue body
- Blank lines between paragraphs are preserved in the body
- Leading blank lines and CRLF line endings handled correctly

### File Lifecycle (Archive)
- Successfully shipped files are moved to a timestamped sub-folder under `_courier_processed/`
- A companion `.meta.json` file is written alongside each archived draft with the source path and created issue URL
- Already-archived files are skipped automatically to prevent duplicate submissions
- Archive folder configurable via `courier.archiveFolder` setting

### UX
- Multi-select QuickPick confirmation before any files are shipped — deselect individual files to skip them
- Spinning status bar item shows progress during background processing, updating per-file
- Summary notification on completion with issue numbers/keys and an "Open" action for the browser
- Per-file error detail shown in a separate notification without aborting the rest of the batch

### Configuration
- `courier.sourceFolder` — default folder scanned for draft `.md` files
- `courier.archiveFolder` — destination folder for processed files (default: `_courier_processed`)
- `courier.filePattern` — glob pattern for finding drafts (default: `**/*.md`)
- `courier.defaultTemplate` — fallback parse template when no project template file is present
- `courier.github.repo` — static `owner/repo` override for GitHub
- `courier.jira.baseUrl` — Jira Cloud instance URL
- `courier.jira.defaultProject` — default Jira project key
- `courier.jira.defaultIssueType` — default Jira issue type (default: `Task`)

## Known Issues
- Jira assignee is set via the `name` field (email address), which works for Jira Server and user-managed Cloud accounts. Accounts managed through Atlassian Access require an `accountId` lookup, which is not yet supported.
- The `courier.defaultTemplate` setting currently only supports the built-in `lineOne` type. Custom template types are parsed as `lineOne` until additional parsers are added.
- No icon asset (`media/logo.png`) is bundled yet; the extension installs without one until a logo is added.

---

