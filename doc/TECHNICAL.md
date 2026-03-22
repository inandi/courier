# Courier — Technical Documentation

## 1. Overview

Courier is a VS Code extension (TypeScript) that ships Markdown (`.md`) draft files as issues or tickets to external project management platforms — currently **GitHub** and **Jira Cloud** — without the user leaving their editor.

The extension is zero-dependency at runtime beyond `octokit` (GitHub REST client). Jira uses Node's built-in `https` module. No bundler (esbuild/webpack) is used; TypeScript compiles directly to CommonJS modules under `out/`.

---

## 2. Repository layout

```
courier/
├── src/
│   ├── extension.ts              # Activation entry point; registers all commands
│   ├── commands/
│   │   ├── shipToGitHub.ts       # GitHub ship flow (3 entry points + core logic)
│   │   └── shipToJira.ts         # Jira ship flow  (3 entry points + core logic)
│   ├── providers/
│   │   ├── githubProvider.ts     # GitHub auth, repo detection, Octokit issue creation
│   │   └── jiraProvider.ts       # Jira auth, project/type resolution, REST API issue creation
│   ├── parser/
│   │   ├── index.ts              # Barrel re-export
│   │   ├── lineOne.ts            # LineOne parser + ParsedDraft interface
│   │   ├── frontmatter.ts        # YAML-lite frontmatter parser (---)
│   │   └── templateParser.ts     # Template resolution + parseWithTemplate()
│   ├── utils/
│   │   ├── fileUtils.ts          # File scanning, reading, archive
│   │   └── uiUtils.ts            # Shared QuickPick confirmation + status bar spinner
│   └── __mocks__/
│       └── vscode.ts             # Minimal VS Code API stub for Jest
├── _doc/
│   ├── TECHNICAL.md              # This file
│   └── PROCESS.md                # Development and release process
├── jest.config.js                # Jest + ts-jest configuration
├── tsconfig.json                 # TypeScript compiler options
├── package.json                  # Extension manifest + npm scripts
├── CHANGELOG.md                  # Version history
└── version.md                    # Short version log
```

---

## 3. Architecture

```
User action (command palette / explorer right-click)
        │
        ▼
extension.ts  ──── registerCommand ────▶  commands/shipToGitHub.ts
                                     └──▶ commands/shipToJira.ts
                                                  │
                              ┌───────────────────┤
                              │                   │
                              ▼                   ▼
                       utils/uiUtils.ts    parser/
                       confirmFiles()      ├── frontmatter.ts   (strip ---)
                       createStatusBar()   ├── lineOne.ts       (title / body)
                                          └── templateParser.ts (merge metadata)
                              │
                  ┌───────────┴───────────┐
                  ▼                       ▼
        providers/githubProvider.ts  providers/jiraProvider.ts
        (Octokit REST)               (Node https, Jira REST v2)
                  │                       │
                  ▼                       ▼
           GitHub Issues API        Jira Cloud REST API
                  │                       │
                  └───────────┬───────────┘
                              ▼
                       utils/fileUtils.ts
                       moveToArchive()
                       _courier_processed/<timestamp>/
```

---

## 4. Module reference

### 4.1 `src/extension.ts`

The VS Code activation entry point. Runs when any `courier.*` command is first invoked.

**Registers 8 commands:**

| Command ID | Handler |
|---|---|
| `courier.shipFolderToGitHub` | `shipFolderToGitHub(context)` |
| `courier.shipSelectedFiles` | `shipSelectedFiles(context)` |
| `courier.shipFilesFromExplorer` | `shipFilesFromExplorer(context, resource)` |
| `courier.configureGitHubToken` | `promptForGitHubToken(context)` |
| `courier.shipFolderToJira` | `shipFolderToJira(context)` |
| `courier.shipSelectedFilesToJira` | `shipSelectedFilesToJira(context)` |
| `courier.shipFileToJiraFromExplorer` | `shipFileToJiraFromExplorer(context, resource)` |
| `courier.configureJira` | `promptAndSaveJiraCredentials(context)` |

All commands receive `vscode.ExtensionContext` for access to `secrets` (SecretStorage) and workspace state.

---

### 4.2 `src/commands/shipToGitHub.ts`

**Entry points (exported):**

```typescript
shipFolderToGitHub(context: ExtensionContext): Promise<void>
shipSelectedFiles(context: ExtensionContext): Promise<void>
shipFilesFromExplorer(context: ExtensionContext, resource: Uri): Promise<void>
```

**Internal flow for all three:**
1. Resolve the workspace folder / folder URI.
2. Scan for `.md` files using `findMdFiles()`.
3. Call `confirmFiles()` — QuickPick multi-select, all pre-ticked; user can deselect; Escape cancels.
4. Call `resolveRepo()` to determine `{ owner, repo }`.
5. Call internal `shipFiles(confirmed, workspaceRoot, context)`.
6. Call `showSummary(results, repoSlug)`.

**`shipFiles()` (internal):**
1. Calls `resolveRepo()` → aborts if no repo resolved.
2. Calls `resolveTemplate()` to pick LineOne / project / user template.
3. Creates a status bar spinner via `createShipStatusBar()`.
4. Iterates each URI:
   - Skips archived files (`isInArchive()`).
   - Reads content, calls `parseWithTemplate()`.
   - Calls `getGitHubToken()` → `createIssueViaApi()`.
   - Calls `moveToArchive()` on success.
5. Disposes the status bar in a `finally` block.

**`ShipResult` interface:**
```typescript
interface ShipResult {
  file: string;
  success: boolean;
  url?: string;
  issueNumber?: number;
  error?: string;
}
```

---

### 4.3 `src/commands/shipToJira.ts`

**Entry points (exported):**

```typescript
shipFolderToJira(context: ExtensionContext): Promise<void>
shipSelectedFilesToJira(context: ExtensionContext): Promise<void>
shipFileToJiraFromExplorer(context: ExtensionContext, resource: Uri): Promise<void>
promptAndSaveJiraCredentials(context: ExtensionContext): Promise<JiraCredentials | null>
```

**`shipFilesToJira()` internal flow:**
1. `getJiraCredentials()` — if null, prompt to configure with "Configure Now" button.
2. Pre-scan all files: if any file lacks a `project` frontmatter field, resolve a session-level default project and issue type by calling `resolveJiraProject()` + `resolveJiraIssueType()` once.
3. Create status bar spinner.
4. Iterate each URI:
   - Skip archived files.
   - Parse with template.
   - Determine `projectKey = draft.project ?? sessionProject` and `issueType = draft.issuetype ?? sessionIssueType`.
   - Call `createJiraIssue()`.
   - Call `moveToArchive()`.
5. Dispose status bar in `finally`.

**`ShipJiraResult` interface:**
```typescript
interface ShipJiraResult {
  file: string;
  success: boolean;
  key?: string;    // e.g. "PROJ-42"
  url?: string;    // browser URL
  error?: string;
}
```

**Credential prompt flow (`promptAndSaveJiraCredentials`):**
1. Three sequential `showInputBox()` calls: base URL → email → API token (password-masked).
2. Immediately validates with a `GET /rest/api/2/myself` call.
3. On success, calls `saveJiraCredentials()` to write to settings + SecretStorage.
4. On failure, shows an error message and returns `null` (credentials are not saved).

---

### 4.4 `src/providers/githubProvider.ts`

**Authentication:**

```
getGitHubToken(context)
  │
  ├── vscode.authentication.getSession('github', ['repo'], { createIfNone: false })
  │     VS Code built-in GitHub OAuth (no external tools)
  │
  └── context.secrets.get('courier.github.token')
        Manually stored PAT via "Courier: Sign in to GitHub"
```

`promptForGitHubToken(context)` — used by the configure command. Tries OAuth first (`createIfNone: true`), falls back to `showInputBox()` for a PAT, stores result in SecretStorage.

**Repo detection (`resolveRepo`):**

Priority chain:
1. `courier.github.repo` VS Code setting (e.g. `"owner/repo"`).
2. `getRepoFromGitConfig(workspaceRoot)` — reads `.git/config`, finds `[remote "origin"]`, parses the URL.
3. `showInputBox()` prompt asking for `owner/repo`.

**`parseGitHubRemoteUrl(url)`** — handles both formats:
- HTTPS: `https://github.com/owner/repo[.git]`
- SSH: `git@github.com:owner/repo[.git]`

**Issue creation (`createIssueViaApi`):**

```typescript
createIssueViaApi(
  repo: GitHubRepo,
  title: string,
  body: string,
  token: string,
  meta: IssueMetadata = {}    // labels, assignees, milestone
): Promise<CreateIssueResult>
```

Uses `octokit.rest.issues.create`. Returns `{ url: string, number: number }`.

**Exported interfaces:**
```typescript
interface GitHubRepo      { owner: string; repo: string }
interface CreateIssueResult { url: string; number: number }
interface IssueMetadata   { labels?: string[]; assignees?: string[]; milestone?: number }
```

---

### 4.5 `src/providers/jiraProvider.ts`

**Authentication storage:**

| Data | Storage location |
|---|---|
| `baseUrl` | VS Code setting `courier.jira.baseUrl` (plaintext, non-sensitive) |
| `email` | VS Code SecretStorage key `courier.jira.email` |
| `token` | VS Code SecretStorage key `courier.jira.token` |

SecretStorage is encrypted by the OS keychain (Keychain on macOS, Credential Manager on Windows, libsecret on Linux).

**HTTP helper (`jiraRequest<T>`):**

Internal generic function. Uses Node's `https` (or `http` for non-SSL instances). Builds a `Basic` auth header as `base64(email:token)`. Parses JSON response. On non-2xx status, extracts Jira's `errorMessages` and `errors` fields and throws a descriptive `Error`.

**API surface:**

| Function | HTTP call | Purpose |
|---|---|---|
| `listProjects(creds)` | `GET /rest/api/2/project` | Returns `JiraProject[]` |
| `listIssueTypes(creds, projectKey)` | `GET /rest/api/2/issue/createmeta?projectKeys=…&expand=…` | Returns non-subtask `JiraIssueType[]` |
| `createJiraIssue(creds, payload)` | `POST /rest/api/2/issue` | Returns `CreateJiraIssueResult` |
| `validateJiraCredentials(creds)` | `GET /rest/api/2/myself` | Returns error string or `null` |

**Issue creation payload (`JiraIssuePayload`):**
```typescript
interface JiraIssuePayload {
  projectKey: string;       // required, e.g. "PROJ"
  summary: string;          // required, mapped from draft.title
  description?: string;     // mapped from draft.body
  issueType: string;        // required, e.g. "Story"
  labels?: string[];
  assigneeEmail?: string;   // only first assignee is sent (Jira limitation)
  priority?: string;        // e.g. "High"
}
```

Fields are mapped to the Jira REST `fields` object:
- `assignee` → `{ name: assigneeEmail }` (works for Jira Cloud user-managed accounts and Jira Server/DC)
- `priority` → `{ name: priorityString }`
- `issuetype` → `{ name: issueTypeName }`

**Resolution helpers:**

`resolveJiraProject(creds, draftProject, sessionDefault)` — priority chain:
1. `draftProject` (from frontmatter)
2. `sessionDefault` (resolved once per batch run)
3. `courier.jira.defaultProject` VS Code setting
4. Live QuickPick from `listProjects()`

`resolveJiraIssueType(creds, projectKey, draftIssueType, sessionDefault)` — same pattern:
1. `draftIssueType` (frontmatter)
2. `sessionDefault`
3. `courier.jira.defaultIssueType` setting
4. Live QuickPick from `listIssueTypes()` (falls back to Task/Story/Bug if the endpoint fails)

---

### 4.6 `src/parser/lineOne.ts`

The default and only active parsing strategy.

**Algorithm:**
1. Split content on `\r?\n`, trim each line.
2. Find `firstIdx` = index of first non-empty line.
3. `title = lines[firstIdx]`
4. `body = lines.slice(firstIdx + 1).join('\n').trim()`

Empty content → returns `null`. Single line → `body = ""`. Blank lines between body paragraphs are preserved.

**`ParsedDraft` interface (canonical shared type):**
```typescript
interface ParsedDraft {
  title: string;
  body: string;
  // GitHub
  labels?: string[];
  assignees?: string[];
  milestone?: number;
  // Jira
  project?: string;
  issuetype?: string;
  priority?: string;
}
```

---

### 4.7 `src/parser/frontmatter.ts`

Parses an optional `---` block at the top of an `.md` file. Does not require `js-yaml` or any external library.

**Detection regex:**
```
/^\s*---\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/
```

Matches the opening `---`, captures the block contents, captures remaining body after the closing `---`.

**Supported keys (case-insensitive):**

| Key(s) | Type | Maps to |
|---|---|---|
| `labels`, `label` | comma-separated strings | `FrontmatterData.labels` |
| `assignees`, `assignee` | comma-separated strings | `FrontmatterData.assignees` |
| `milestone` | integer | `FrontmatterData.milestone` |
| `project` | string | `FrontmatterData.project` |
| `issuetype`, `issue_type`, `type` | string | `FrontmatterData.issuetype` |
| `priority` | string | `FrontmatterData.priority` |

CRLF line endings are normalized to LF before parsing. Unknown keys are silently ignored.

**`FrontmatterResult`:**
```typescript
interface FrontmatterResult {
  data: FrontmatterData;
  content: string;    // content after stripping the --- block
}
```

---

### 4.8 `src/parser/templateParser.ts`

**`resolveTemplate(workspaceRoot)`** — priority chain:
1. `.vscode/courier.template.json` (project-level)
2. `courier.template.json` (project-level, alternate location)
3. `courier.defaultTemplate` VS Code setting
4. Built-in default: `{ type: 'lineOne', titleLine: 1, bodyFrom: 2 }`

**`parseWithTemplate(content, template)`:**
1. `parseFrontmatter(content)` → strips `---` block, extracts metadata.
2. Calls `parseLineOne(remainingContent)` regardless of template type (only `lineOne` is currently implemented).
3. Merges frontmatter data fields into the draft: `labels`, `assignees`, `milestone`, `project`, `issuetype`, `priority`.
4. Returns `null` if the body content is empty.

**`CourierTemplate` interface:**
```typescript
interface CourierTemplate {
  type: string;           // currently only 'lineOne' is active
  titleLine?: number;
  bodyFrom?: number;
  [key: string]: unknown;
}
```

---

### 4.9 `src/utils/fileUtils.ts`

**`findMdFiles(folderUri, pattern)`**
Calls `vscode.workspace.findFiles()` with a `RelativePattern`. Ensures the glob always starts with `**/`. Post-filters to `.md` extension.

**`readFileContent(uri)`**
Opens the file as a VS Code `TextDocument` (respects encoding, uses VS Code's file system layer). Returns the full text as a string.

**`moveToArchive(sourceUri, workspaceRoot, issueUrl?)`**
- Reads `courier.archiveFolder` setting (default `_courier_processed`).
- Creates `<archiveFolder>/<ISO-timestamp>/` — timestamp format: `2026-03-22T14-30-00` (colons and dots replaced with hyphens, truncated to seconds).
- Uses `fs.promises.rename()` (atomic on same filesystem).
- If `issueUrl` is provided, writes a `.meta.json` sidecar:
  ```json
  { "source": "/original/path/file.md", "issueUrl": "https://…" }
  ```

**`isInArchive(fileUri, workspaceRoot)`**
Normalizes both paths with `path.normalize()` before comparing, preventing false negatives from mixed separators on Windows.

**`getArchiveFolder(workspaceRoot)`**
Returns the absolute path to the archive directory. Does not create it.

---

### 4.10 `src/utils/uiUtils.ts`

Shared helpers used by both `shipToGitHub.ts` and `shipToJira.ts`.

**`confirmFiles(fileUris, title?)`**
- Renders a `showQuickPick` with `canPickMany: true`.
- All items start `picked: true` (opt-out model).
- Each item shows: `$(markdown) filename.md` (label) + relative path (description).
- Returns `null` if user presses Escape or selects zero items.

**`createShipStatusBar(message)`**
- Creates a `StatusBarItem` at `StatusBarAlignment.Left`, priority `100`.
- Sets `text = "$(sync~spin) Courier: <message>"` — VS Code's built-in animated spinner icon.
- Calls `.show()` immediately.
- **Caller must call `.dispose()` in a `finally` block.**

---

## 5. Data flow: end-to-end for a GitHub ship

```
1. User: right-click file.md → "Courier: Ship to GitHub"
2. extension.ts → shipFilesFromExplorer(context, Uri)
3. confirmFiles([Uri], 'Courier — Create GitHub Issue')
       → QuickPick with one item, all ticked
       → User presses Enter
4. resolveRepo(workspaceRoot, context)
       → reads .git/config
       → parses "git@github.com:owner/repo.git"
       → returns { owner: "owner", repo: "repo" }
5. shipFiles([Uri], workspaceRoot, context)
   a. isInArchive(Uri) → false
   b. readFileContent(Uri) → raw string
   c. parseWithTemplate(raw, template)
         parseFrontmatter(raw)
           → strips "---\nlabels: bug\n---\n"
           → data = { labels: ['bug'] }
         parseLineOne(remainingContent)
           → { title: "Fix login bug", body: "Repro steps..." }
         merge → { title, body, labels: ['bug'] }
   d. getGitHubToken(context)
         → vscode.authentication.getSession('github', ['repo'])
         → returns access_token
   e. createIssueViaApi({ owner, repo }, title, body, token, { labels: ['bug'] })
         → POST https://api.github.com/repos/owner/repo/issues
         → returns { url: "https://github.com/.../issues/42", number: 42 }
   f. moveToArchive(Uri, workspaceRoot, issueUrl)
         → renames file to _courier_processed/2026-03-22T14-30-00/file.md
         → writes _courier_processed/2026-03-22T14-30-00/file.md.meta.json
   g. results.push({ success: true, url, issueNumber: 42 })
6. showSummary(results, "owner/repo")
       → showInformationMessage("Courier: 1 issue(s) created — #42", "Open on GitHub")
```

---

## 6. Data flow: end-to-end for a Jira ship

```
1. User: Command Palette → "Courier: Ship Folder to Jira"
2. shipFolderToJira(context)
3. findMdFiles(folderUri, "**/*.md") → [Uri1, Uri2, Uri3]
4. confirmFiles([Uri1, Uri2, Uri3], 'Courier — Create Jira Tickets')
       → User deselects Uri3, presses Enter
       → confirmed = [Uri1, Uri2]
5. shipFilesToJira([Uri1, Uri2], workspaceRoot, context)
   a. getJiraCredentials(context)
         → reads setting courier.jira.baseUrl
         → reads secrets courier.jira.email, courier.jira.token
         → returns { baseUrl, email, token }
   b. Pre-scan: Uri1 has no frontmatter project → needsProjectPrompt = true
   c. resolveJiraProject(creds, undefined, undefined)
         → courier.jira.defaultProject setting is empty
         → GET https://myco.atlassian.net/rest/api/2/project
         → QuickPick: user picks "PROJ"
         → sessionProject = "PROJ"
   d. resolveJiraIssueType(creds, "PROJ", undefined, undefined)
         → courier.jira.defaultIssueType = "Task"
         → returns "Task" immediately (no prompt)
         → sessionIssueType = "Task"
   e. createShipStatusBar("shipping 2 file(s) to Jira…")
   f. For Uri1:
         parseWithTemplate → { title, body, labels: ['api'] }
         projectKey = "PROJ", issueType = "Task"
         POST /rest/api/2/issue → { id, key: "PROJ-7", self }
         moveToArchive → _courier_processed/2026-03-22T14-30-01/file1.md
   g. For Uri2 (has "project: BACKEND" in frontmatter):
         parseWithTemplate → { title, body, project: "BACKEND", issuetype: "Story" }
         projectKey = "BACKEND", issueType = "Story"
         POST /rest/api/2/issue → { key: "BACKEND-23" }
         moveToArchive
   h. statusBar.dispose()
6. showJiraSummary → "2 Jira ticket(s) created — PROJ-7, BACKEND-23"
```

---

## 7. Configuration reference

All settings live under the `courier` namespace in VS Code settings (`.vscode/settings.json` or user settings).

### Shared

| Setting | Type | Default | Description |
|---|---|---|---|
| `courier.sourceFolder` | `string` | `""` | Sub-folder to scan when using "Ship Folder" commands. Empty = entire workspace root. |
| `courier.archiveFolder` | `string` | `"_courier_processed"` | Root of the archive directory. Relative to workspace root. |
| `courier.filePattern` | `string` | `"**/*.md"` | Glob pattern for draft file discovery. |
| `courier.defaultTemplate` | `object` | `{ "type": "lineOne" }` | Fallback template JSON when no project-level template file is found. |

### GitHub

| Setting | Type | Default | Description |
|---|---|---|---|
| `courier.github.repo` | `string` | `""` | Hard-coded `owner/repo` override. Leave empty to auto-detect from `.git/config`. |

### Jira

| Setting | Type | Default | Description |
|---|---|---|---|
| `courier.jira.baseUrl` | `string` | `""` | Jira Cloud instance URL, e.g. `https://mycompany.atlassian.net`. Written by "Courier: Configure Jira". |
| `courier.jira.defaultProject` | `string` | `""` | Default project key. Leave empty to be prompted per run. |
| `courier.jira.defaultIssueType` | `string` | `"Task"` | Default issue type. Leave empty to be prompted per run. |

---

## 8. Credential security model

### GitHub

| Method | How stored | When used |
|---|---|---|
| VS Code OAuth | Managed by VS Code's built-in GitHub auth provider (OS keychain) | Primary method; user signs in once |
| Personal Access Token (PAT) | VS Code `SecretStorage` under key `courier.github.token` | Fallback when OAuth unavailable or user prefers PAT |

Required scope: `repo` (to create issues in private repositories).

### Jira

| Data | Storage |
|---|---|
| Base URL | VS Code user setting `courier.jira.baseUrl` (plaintext; non-sensitive) |
| Email | VS Code `SecretStorage` key `courier.jira.email` |
| API Token | VS Code `SecretStorage` key `courier.jira.token` |

`SecretStorage` is backed by the OS credential manager. Tokens are never written to disk in plaintext and are not part of `settings.json`.

---

## 9. Frontmatter specification

Full reference for the `---` frontmatter block supported at the top of any `.md` file.

```
---
<key>: <value>
---

<title line>
<body lines>
```

### Rules
- The `---` opening must appear at the very top of the file (leading blank lines are tolerated).
- Keys are case-insensitive.
- All fields are optional.
- CRLF line endings are normalized before parsing.
- Unknown keys are silently ignored.

### Field reference

| Key | Aliases | Value format | Platform |
|---|---|---|---|
| `labels` | `label` | Comma-separated strings | GitHub + Jira |
| `assignees` | `assignee` | Comma-separated strings / emails | GitHub (usernames) / Jira (email, first only) |
| `milestone` | — | Integer (GitHub milestone number) | GitHub only |
| `project` | — | String (Jira project key) | Jira only |
| `issuetype` | `issue_type`, `type` | String (Jira issue type name) | Jira only |
| `priority` | — | String (Jira priority name) | Jira only |

### Example — GitHub

```md
---
labels: bug, regression
assignees: alice, bob
milestone: 4
---

Fix null pointer in payment flow

StackTrace captured in Sentry: https://sentry.io/...
Affects v3.2.1 and above.
```

### Example — Jira

```md
---
project: PROJ
issuetype: Story
priority: High
labels: backend, api
assignee: alice@company.com
---

Implement rate limiting on /api/search

Add token-bucket rate limiting: 100 req/min per user.
Return 429 with Retry-After header on breach.
```

### Example — no frontmatter (LineOne defaults)

```md
Fix login redirect loop

Users are stuck in a redirect when session expires.
Repro: log out, then visit /dashboard.
```

---

## 10. Archive system

After a file is successfully shipped, it is moved out of its original location into an archive tree. This prevents accidental double-posting.

### Directory structure

```
<workspace>/
└── _courier_processed/
    ├── 2026-03-22T14-30-00/
    │   ├── fix-login.md
    │   └── fix-login.md.meta.json
    └── 2026-03-22T15-01-42/
        ├── rate-limiting.md
        └── rate-limiting.md.meta.json
```

### Timestamp format

`new Date().toISOString()` produces `2026-03-22T14:30:00.000Z`. Colons and dots are replaced with hyphens and the string is truncated to 19 characters: `2026-03-22T14-30-00`.

Each archive sub-folder contains exactly the files processed in that one shipping run.

### Meta sidecar (`.meta.json`)

```json
{
  "source": "/Users/alice/project/drafts/fix-login.md",
  "issueUrl": "https://github.com/owner/repo/issues/42"
}
```

Written for every successfully shipped file. Contains the original absolute path and the URL of the created issue/ticket.

### Idempotency guard

Before processing, `isInArchive(fileUri, workspaceRoot)` checks whether the file's path starts with the archive root (using `path.normalize` on both sides). If true, the file is skipped with the result message `"Already shipped (file is in archive)"`.

---

## 11. Template system

Templates determine how an `.md` file is parsed into `{ title, body }`.

### Resolution chain (highest priority first)

1. **Project template** — `.vscode/courier.template.json` in the workspace root
2. **Project template (alternate)** — `courier.template.json` in the workspace root
3. **User setting** — `courier.defaultTemplate` in VS Code settings
4. **Built-in default** — `{ "type": "lineOne", "titleLine": 1, "bodyFrom": 2 }`

### Template file format

```json
{
  "type": "lineOne",
  "titleLine": 1,
  "bodyFrom": 2
}
```

The `type` field is required. `titleLine` and `bodyFrom` are currently descriptive only (the `lineOne` parser always uses the first non-empty line as the title, regardless of these values).

Only `lineOne` is implemented. The `type` field is read and dispatched in `parseWithTemplate()` — adding a new parser type requires adding a new `if` branch there.

---

## 12. Test suite

Tests live alongside the source files with the `.test.ts` suffix and are excluded from the TypeScript compilation output (`outDir`). They run with Jest + ts-jest.

### Test files

| File | What is tested |
|---|---|
| `src/parser/lineOne.test.ts` | `parseLineOne` — 12 cases: empty, single line, body, leading blanks, blank lines in body, CRLF, whitespace trimming, multi-line |
| `src/parser/frontmatter.test.ts` | `parseFrontmatter` — 22 cases: no frontmatter, labels/aliases, assignees/aliases, milestone, combined Jira block, CRLF, unknown keys, Jira fields |
| `src/providers/githubProvider.test.ts` | `parseGitHubRemoteUrl` — 9 cases: HTTPS with/without .git, HTTPS with embedded token, SSH with/without .git, non-GitHub remotes, empty/invalid |
| `src/providers/jiraProvider.test.ts` | `normalizeBaseUrl`, `buildIssueUrl` — 12 cases covering protocol, trailing slashes, whitespace, non-SSL |

**Total: 51 tests, 4 suites.**

### Jest configuration (`jest.config.js`)

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/__mocks__/vscode.ts',
  },
};
```

The `vscode` module is stubbed with `src/__mocks__/vscode.ts` — a minimal object covering the VS Code API surface used by the files under test.

### Running tests

```bash
npm test              # all tests
npx jest --watch      # watch mode
npx jest src/parser   # specific folder
```

---

## 13. Build system

```bash
npm run compile        # tsc -p ./ — emits to out/
npm run watch          # tsc -watch -p ./ — incremental
npm run vscode:prepublish  # runs compile (used by vsce package)
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

- `target: ES2022` — async/await compiles natively, no downlevelling.
- `module: commonjs` — required for VS Code extensions.
- `strict: true` — `strictNullChecks`, `noImplicitAny`, etc. are all active.
- Test files are not excluded from `rootDir` but are excluded from compilation by Jest running `ts-jest` independently.

### Runtime dependencies

| Package | Version | Purpose |
|---|---|---|
| `octokit` | `^3.0.0` | GitHub REST API client |

### Dev dependencies

| Package | Purpose |
|---|---|
| `typescript` | Compiler |
| `@types/vscode` | VS Code API type definitions |
| `@types/node` | Node.js type definitions |
| `jest` | Test runner |
| `ts-jest` | TypeScript transform for Jest |
| `@types/jest` | Jest type definitions |

---

## 14. Extension manifest (`package.json`) highlights

### Activation events

The extension is not loaded at startup. It activates lazily when any `courier.*` command is first invoked:

```json
"activationEvents": [
  "onCommand:courier.shipFolderToGitHub",
  "onCommand:courier.shipSelectedFiles",
  ...
]
```

### Explorer context menu

Two items are injected into the right-click menu for `.md` files:

```json
{
  "command": "courier.shipFilesFromExplorer",
  "when": "explorerResourceIsFolder == false && resourceExtname == .md",
  "group": "courier@1"
},
{
  "command": "courier.shipFileToJiraFromExplorer",
  "when": "explorerResourceIsFolder == false && resourceExtname == .md",
  "group": "courier@2"
}
```

The `when` clause ensures the items only appear for files (not folders) with a `.md` extension.
