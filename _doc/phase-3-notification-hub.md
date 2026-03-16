# Phase 3: Notification Hub & Relay

## Epic

**As a** developer  
**I want** to ship one .md file to multiple destinations (GitHub + Jira) and notify my team via Slack  
**So that** I have a single workflow that keeps everyone in sync

---

## User Stories

### US-3.1: Ship to All (Multi-Post Relay)

**As a** developer  
**I want** to ship a single .md file to both GitHub and Jira in one action  
**So that** I don't have to run separate commands for each platform

**Acceptance Criteria:**
- [ ] Command: "Courier: Ship to All"
- [ ] Same source selection and template parsing as Phase 1 & 2
- [ ] Configurable targets via `courier.relay.targets` (e.g. `["github", "jira"]`)
- [ ] Execute deliveries in parallel (`Promise.all`) for speed
- [ ] Collect results (success/failure, URLs) for each target
- [ ] Show combined summary (e.g. "GitHub #42, JIRA PROJ-123")
- [ ] Archive file only after all configured targets succeed (or configurable behavior)

---

### US-3.2: Slack Webhook Configuration

**As a** developer  
**I want** to configure a Slack webhook URL in Courier  
**So that** my team gets notified when I ship tasks

**Acceptance Criteria:**
- [ ] Store webhook URL in SecretStorage (`courier.slack.webhookUrl`)
- [ ] Command or settings to configure webhook
- [ ] Validate URL format before saving
- [ ] Option to enable/disable Slack notifications via setting

---

### US-3.3: Slack Notification on Ship

**As a** team member  
**I want** to receive a Slack message when someone ships a task via Courier  
**So that** I'm aware of new issues without checking GitHub/Jira

**Acceptance Criteria:**
- [ ] After successful ship (GitHub, Jira, or relay): POST to Slack webhook
- [ ] Payload includes: title, links to created issues (GitHub #, JIRA key)
- [ ] Configurable trigger: always, only on relay, or per-target
- [ ] Use Slack Block Kit for richer formatting (optional)
- [ ] Graceful failure if webhook not configured or fails (don't block ship)

---

### US-3.4: Courier Status Dashboard

**As a** developer  
**I want** a sidebar view showing recent delivery status  
**So that** I can track what was shipped and access links quickly

**Acceptance Criteria:**
- [ ] Sidebar view: "Courier Status" in activity bar
- [ ] Display recent deliveries: file, targets, status, URLs, timestamp
- [ ] Data persisted (lightweight JSON file or workspace state)
- [ ] Clickable links to GitHub issues and Jira tickets
- [ ] Clear or refresh list option
- [ ] Contribution: `viewsContainers` + `views` in package.json

---

### US-3.5: Status Dashboard Webview

**As a** developer  
**I want** the status dashboard to be a proper webview  
**So that** I get a clean, readable layout for delivery history

**Acceptance Criteria:**
- [ ] Webview panel or tree view for status display
- [ ] Table or list: File | GitHub | Jira | Slack | Time
- [ ] Styling consistent with VS Code theme
- [ ] Persist across VS Code sessions (workspace or global)
