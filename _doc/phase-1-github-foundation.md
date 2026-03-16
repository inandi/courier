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
- [ ] Extension structure with `package.json`, `tsconfig.json`, `extension.ts`
- [ ] `engines.vscode` ~1.85+
- [ ] Activation on command
- [ ] Folder structure: `src/extension.ts`, `src/parser/`, `src/providers/`, `src/commands/`, `src/utils/`
- [ ] Extension runs in Extension Development Host

---

### US-1.2: Template Resolution

**As a** developer using Courier  
**I want** the extension to resolve which template to use (project → user default → LineOne)  
**So that** different projects can use different .md formats

**Acceptance Criteria:**
- [ ] Resolve template from `.vscode/courier.template.json` or `courier.template.json` at workspace root
- [ ] Fall back to user setting `courier.defaultTemplate` if no project template
- [ ] Fall back to built-in LineOne if no template found
- [ ] Log which template was used (optional, for debugging)

---

### US-1.3: LineOne Parser

**As a** developer  
**I want** .md files parsed with Line 1 = title, Line 2+ = body  
**So that** I can use a simple, predictable format for drafts

**Acceptance Criteria:**
- [ ] Input: .md file path or content
- [ ] Output: `{ title: string, body: string }`
- [ ] First non-empty line = title; remaining lines = body (trimmed)
- [ ] Empty file → skip or return error
- [ ] Single-line file → body = empty string
- [ ] Unit tests for edge cases

---

### US-1.4: Ship Folder to GitHub

**As a** developer  
**I want** to select a workspace folder and ship all .md files as GitHub issues  
**So that** I can bulk-create issues from a drafts folder

**Acceptance Criteria:**
- [ ] Command: "Courier: Ship Folder to GitHub"
- [ ] Prompts for folder (or uses `vscode.workspace.workspaceFolders`)
- [ ] Scans folder for .md files per `courier.filePattern` glob
- [ ] Parses each file with resolved template
- [ ] Creates GitHub issue for each file (title, body)
- [ ] Shows progress notification during bulk creation
- [ ] Displays success/failure summary

---

### US-1.5: Ship Selected Files to GitHub

**As a** developer  
**I want** to select specific .md files and ship them as GitHub issues  
**So that** I can ship only the drafts I choose

**Acceptance Criteria:**
- [ ] Command: "Courier: Ship Selected Files"
- [ ] Multi-select .md files from explorer or file picker
- [ ] Parses each selected file with resolved template
- [ ] Creates GitHub issue for each file
- [ ] Shows progress and summary

---

### US-1.6: GitHub Integration via gh CLI

**As a** developer with GitHub CLI installed  
**I want** Courier to use my existing `gh` authentication  
**So that** I don't need to configure a token separately

**Acceptance Criteria:**
- [ ] Check `gh auth status` before creating issues
- [ ] Use `gh issue create --title "..." --body "..."` via `child_process.exec`
- [ ] Infer repo from `gh repo view` when in a git repo
- [ ] If not authenticated, show clear error with setup instructions

---

### US-1.7: GitHub Integration via Octokit (Fallback)

**As a** developer without gh CLI or preferring API  
**I want** Courier to use a GitHub token (from `gh auth token` or manual)  
**So that** I can still create issues

**Acceptance Criteria:**
- [ ] Fallback when gh CLI not available or not authenticated
- [ ] Try `gh auth token` first for token
- [ ] Option to store manual token via SecretStorage
- [ ] Use Octokit.js `issues.create` with owner/repo
- [ ] Command or setting to configure token

---

### US-1.8: Processed Archive

**As a** developer  
**I want** shipped files moved to an archive folder  
**So that** I never double-post and have a traceable history

**Acceptance Criteria:**
- [ ] On success: move file to `_courier_processed/<timestamp>/<filename>`
- [ ] Configurable via `courier.archiveFolder`
- [ ] Skip files already in archive (idempotency)
- [ ] Optional: JSON sidecar mapping filename → issue URL

---

### US-1.9: Configuration

**As a** developer  
**I want** configurable settings for source folder, archive, file pattern, and GitHub repo  
**So that** I can adapt Courier to my project structure

**Acceptance Criteria:**
- [ ] `courier.sourceFolder` — default folder to scan
- [ ] `courier.archiveFolder` — processed archive path
- [ ] `courier.filePattern` — glob for .md files (default: `**/*.md`)
- [ ] `courier.defaultTemplate` — fallback template
- [ ] `courier.github.repo` — override owner/repo
- [ ] Settings visible in VS Code Settings UI
