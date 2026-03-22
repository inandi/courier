# Phase 1: GitHub Foundation (MVP)

## Epic

**As a** developer who drafts tasks in Markdown files  
**I want** to create GitHub issues directly from VS Code without opening a browser  
**So that** I stay in flow and avoid context switching when capturing and shipping work

---

## User Stories

### US-1.1: Extension Scaffolding

**As a** developer  
**I want** a properly scaffolded VS Code extension with TypeScript  
**So that** I can build and debug Courier locally

**Acceptance Criteria:**
- [x] Extension structure with `package.json`, `tsconfig.json`, `extension.ts`
- [x] `engines.vscode` ~1.85+
- [x] Activation on command
- [x] Folder structure: `src/extension.ts`, `src/parser/`, `src/providers/`, `src/commands/`, `src/utils/`
- [x] Extension runs in Extension Development Host

---

### US-1.2: Template Resolution

**As a** developer using Courier  
**I want** the extension to resolve which template to use (project → user default → LineOne)  
**So that** different projects can use different .md formats

**Acceptance Criteria:**
- [x] Resolve template from `.vscode/courier.template.json` or `courier.template.json` at workspace root
- [x] Fall back to user setting `courier.defaultTemplate` if no project template
- [x] Fall back to built-in LineOne if no template found
- [ ] Log which template was used (optional, for debugging)

---

### US-1.3: LineOne Parser

**As a** developer  
**I want** .md files parsed with Line 1 = title, Line 2+ = body  
**So that** I can use a simple, predictable format for drafts

**Acceptance Criteria:**
- [x] Input: .md file path or content
- [x] Output: `{ title: string, body: string }`
- [x] First non-empty line = title; remaining lines = body (trimmed)
- [x] Empty file → skip or return error
- [x] Single-line file → body = empty string
- [x] Unit tests for edge cases

---

### US-1.4: Ship Folder to GitHub

**As a** developer  
**I want** to select a workspace folder and ship all .md files as GitHub issues  
**So that** I can bulk-create issues from a drafts folder

**Acceptance Criteria:**
- [x] Command: "Courier: Ship Folder to GitHub"
- [x] Prompts for folder (or uses `vscode.workspace.workspaceFolders`)
- [x] Scans folder for .md files per `courier.filePattern` glob
- [x] Parses each file with resolved template
- [x] Creates GitHub issue for each file (title, body)
- [x] Shows progress notification during bulk creation
- [x] Displays success/failure summary

---

### US-1.5: Ship Selected Files to GitHub

**As a** developer  
**I want** to select specific .md files and ship them as GitHub issues  
**So that** I can ship only the drafts I choose

**Acceptance Criteria:**
- [x] Command: "Courier: Ship Selected Files"
- [x] Multi-select .md files from explorer or file picker
- [x] Parses each selected file with resolved template
- [x] Creates GitHub issue for each file
- [x] Shows progress and summary

---

### US-1.6: GitHub Integration via gh CLI

> **Superseded** — Courier no longer depends on the `gh` CLI. Authentication is handled
> entirely through VS Code's built-in GitHub OAuth provider and optional PAT storage.
> The acceptance criteria below are met by the new implementation.

**As a** developer  
**I want** Courier to authenticate with GitHub without external tools  
**So that** I can create issues from any machine

**Acceptance Criteria:**
- [x] Check authentication before creating issues
- [x] Create issues via GitHub REST API
- [x] Infer repo from `.git/config` remote origin when in a git repo
- [x] If not authenticated, show clear error with setup instructions

---

### US-1.7: GitHub Integration via Octokit

**As a** developer  
**I want** Courier to use a GitHub token (from VS Code OAuth or manual PAT)  
**So that** I can still create issues

**Acceptance Criteria:**
- [x] VS Code built-in GitHub OAuth session used as primary auth
- [x] Option to store manual PAT via SecretStorage
- [x] Use `Octokit.rest.issues.create` with owner/repo
- [x] Command to configure token / sign in

---

### US-1.8: Processed Archive

**As a** developer  
**I want** shipped files moved to an archive folder  
**So that** I never double-post and have a traceable history

**Acceptance Criteria:**
- [x] On success: move file to `_courier_processed/<timestamp>/<filename>`
- [x] Configurable via `courier.archiveFolder`
- [x] Skip files already in archive (idempotency)
- [x] Optional: JSON sidecar mapping filename → issue URL

---

### US-1.9: Configuration

**As a** developer  
**I want** configurable settings for source folder, archive, file pattern, and GitHub repo  
**So that** I can adapt Courier to my project structure

**Acceptance Criteria:**
- [x] `courier.sourceFolder` — default folder to scan
- [x] `courier.archiveFolder` — processed archive path
- [x] `courier.filePattern` — glob for .md files (default: `**/*.md`)
- [x] `courier.defaultTemplate` — fallback template
- [x] `courier.github.repo` — override owner/repo
- [x] Settings visible in VS Code Settings UI
