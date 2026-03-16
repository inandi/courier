# Phase 2: Jira Integration

## Epic

**As a** developer working with Jira  
**I want** to create Jira tickets directly from .md files in VS Code  
**So that** I can ship drafts to my team's ticketing system without leaving the editor

---

## User Stories

### US-2.1: Jira Configuration

**As a** developer  
**I want** to securely configure my Jira credentials in Courier  
**So that** I can authenticate with Jira Cloud or Server

**Acceptance Criteria:**
- [ ] Command: "Courier: Configure Jira"
- [ ] Input boxes for: Base URL, Email, API Token
- [ ] Store credentials in VS Code SecretStorage (`courier.jira.baseUrl`, `courier.jira.email`, `courier.jira.apiToken`)
- [ ] Validate connection with `GET /rest/api/2/myself` before saving
- [ ] Show success or error message
- [ ] Option to update or clear credentials

---

### US-2.2: Ship to Jira

**As a** developer  
**I want** to ship .md files as Jira tickets  
**So that** I can create Bug, Task, or Story issues from my drafts

**Acceptance Criteria:**
- [ ] Command: "Courier: Ship to Jira"
- [ ] Same source selection as Phase 1 (folder or selected files)
- [ ] Same template-driven parsing (title → summary, body → description)
- [ ] POST to `{baseUrl}/rest/api/2/issue` with Basic Auth
- [ ] Payload: `{ fields: { project, summary, issuetype, description } }`
- [ ] Show created issue key and link

---

### US-2.3: Project Selection

**As a** developer  
**I want** to choose which Jira project to create the issue in  
**So that** I can target the correct project per context

**Acceptance Criteria:**
- [ ] Fetch projects via `GET /rest/api/2/project`
- [ ] QuickPick dropdown with project names and keys
- [ ] Configurable default via `courier.jira.projectKey`
- [ ] Remember last selection (optional)

---

### US-2.4: Issue Type Selection

**As a** developer  
**I want** to choose the issue type (Bug, Task, Story, etc.) when shipping  
**So that** I create the right kind of ticket

**Acceptance Criteria:**
- [ ] Fetch creatable issue types via `GET /rest/api/2/issue/createmeta`
- [ ] QuickPick dropdown with issue types for selected project
- [ ] Configurable default via `courier.jira.issueType`
- [ ] Support common types: Bug, Task, Story

---

### US-2.5: Jira Provider Architecture

**As a** developer maintaining Courier  
**I want** a clean Jira provider abstraction  
**So that** it integrates consistently with the existing delivery layer

**Acceptance Criteria:**
- [ ] `JiraProvider` class or module with `createIssue(title, body, projectKey, issueType)`
- [ ] Uses Axios or fetch with Basic Auth
- [ ] Error handling for auth failures, invalid project, API errors
- [ ] Returns created issue key and URL
