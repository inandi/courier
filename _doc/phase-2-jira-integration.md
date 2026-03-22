# Phase 2: Jira Integration

## Epic

**As a** developer who drafts tasks in Markdown files  
**I want** to create Jira tickets directly from VS Code  
**So that** I can ship work to Jira without leaving my editor

---

## User Stories

### US-2.1: Jira Credentials

**As a** developer  
**I want** to configure my Jira instance URL, email, and API token once  
**So that** Courier can authenticate with Jira on my behalf

**Acceptance Criteria:**
- [x] Command: "Courier: Configure Jira"
- [x] Prompts for: base URL (e.g. `https://mycompany.atlassian.net`), email, API token
- [x] Base URL stored in VS Code settings (`courier.jira.baseUrl`)
- [x] Email and API token stored in VS Code SecretStorage
- [x] Validates credentials with a test API call before saving
- [x] Clear error message when credentials are invalid

---

### US-2.2: Ship to Jira

**As a** developer  
**I want** to ship .md files as Jira tickets  
**So that** I can bulk-create tickets from draft files

**Acceptance Criteria:**
- [x] Command: "Courier: Ship Folder to Jira"
- [x] Command: "Courier: Ship Selected Files to Jira"
- [x] Command: "Courier: Ship to Jira" (right-click context menu on .md files)
- [x] QuickPick confirmation listing files before shipping
- [x] Status bar spinner during background shipping
- [x] Creates Jira issue for each file (summary = title, description = body)
- [x] Archives shipped files to `_courier_processed/` on success
- [x] Summary notification with issue keys and links on completion

---

### US-2.3: Project Selection

**As a** developer  
**I want** to select the target Jira project  
**So that** tickets land in the right project

**Acceptance Criteria:**
- [x] `courier.jira.defaultProject` setting for a workspace-level default
- [x] Per-file override via frontmatter `project: KEY`
- [x] If no default and no frontmatter, QuickPick from live project list (`GET /rest/api/2/project`)
- [x] Selected project cached for the duration of the ship run

---

### US-2.4: Issue Type Selection

**As a** developer  
**I want** to choose the Jira issue type (Story, Bug, Task, etc.)  
**So that** tickets are created with the right type

**Acceptance Criteria:**
- [x] `courier.jira.defaultIssueType` setting for a workspace-level default
- [x] Per-file override via frontmatter `issuetype: Story`
- [x] If no default and no frontmatter, QuickPick from issue types for the selected project
- [x] Selected issue type cached for the duration of the ship run

---

### US-2.5: Frontmatter Metadata

**As a** developer  
**I want** to embed Jira metadata in my .md files  
**So that** I can control labels, assignee, priority, project, and issue type per file

**Acceptance Criteria:**
- [x] `project` — Jira project key (e.g. `PROJ`)
- [x] `issuetype` — Issue type name (e.g. `Story`, `Bug`, `Task`)
- [x] `priority` — Priority name (e.g. `High`, `Medium`, `Low`)
- [x] `labels` — Comma-separated Jira labels (reuses existing frontmatter field)
- [x] `assignee` — Jira account email or username
- [x] All fields optional; project and issue type fall back to settings/QuickPick

---

## Frontmatter Format

```md
---
project: PROJ
issuetype: Story
priority: High
labels: backend, api
assignee: developer@company.com
---

Implement rate limiting on /api/search

Add token-bucket rate limiting to the search endpoint.
Max 100 req/min per user. Return 429 with Retry-After header.
```
