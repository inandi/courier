/**
 * Courier Jira Provider
 *
 * Handles all Jira Cloud interactions: credential storage and retrieval,
 * project and issue-type listing, issue creation, and resolution helpers
 * that drive the interactive ship flow. All HTTP calls use Node's built-in
 * `https` module — no external libraries are required. Authentication uses
 * Basic Auth (Atlassian account email + API token) with credentials stored
 * in VS Code SecretStorage.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import * as https from 'https';
import * as http from 'http';
import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Jira Cloud Basic-Auth credentials bundle.
 * The baseUrl is always stored in normalized form (https://, no trailing slash).
 *
 * @version 1.1.1
 */
export interface JiraCredentials {
  /** Fully qualified Jira base URL, e.g. `https://myorg.atlassian.net`. */
  baseUrl: string;
  /** Atlassian account email address used for Basic Auth. */
  email: string;
  /** Atlassian API token used as the Basic Auth password. */
  token: string;
}

/**
 * Represents a single Jira project returned by the project list endpoint.
 *
 * @version 1.1.1
 */
export interface JiraProject {
  /** Numeric Jira internal project ID. */
  id: string;
  /** Short project key, e.g. `"PROJ"`. */
  key: string;
  /** Human-readable project display name. */
  name: string;
}

/**
 * Represents a Jira issue type returned by the create-meta endpoint.
 *
 * @version 1.1.1
 */
export interface JiraIssueType {
  /** Numeric Jira internal issue type ID. */
  id: string;
  /** Human-readable issue type name, e.g. `"Story"` or `"Bug"`. */
  name: string;
  /** True when this type is a sub-task; sub-tasks are excluded from QuickPick. */
  subtask: boolean;
}

/**
 * All fields required to create a new Jira issue via the REST API.
 *
 * @version 1.1.1
 */
export interface JiraIssuePayload {
  /** Key of the Jira project to create the issue in, e.g. `"PROJ"`. */
  projectKey: string;
  /** Issue summary (title). Mapped to the Markdown file's first line. */
  summary: string;
  /** Optional long-form description. Mapped to the Markdown file body. */
  description?: string;
  /** Issue type name, e.g. `"Task"` or `"Story"`. */
  issueType: string;
  /** Labels to attach to the issue. */
  labels?: string[];
  /** Assignee email address (used as the `name` field for Server/DC compatibility). */
  assigneeEmail?: string;
  /** Priority name, e.g. `"High"` or `"Medium"`. */
  priority?: string;
}

/**
 * Describes the result of a successful Jira issue creation API call.
 *
 * @version 1.1.1
 */
export interface CreateJiraIssueResult {
  /** Jira internal numeric issue ID. */
  id: string;
  /** Issue key in `PROJECT-123` format. */
  key: string;
  /** Full browser URL to view the created issue. */
  url: string;
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

/** SecretStorage key for the Jira account email. */
const SECRET_EMAIL = 'courier.jira.email';
/** SecretStorage key for the Jira API token. */
const SECRET_TOKEN = 'courier.jira.token';

/**
 * Retrieves stored Jira credentials by reading the `courier.jira.baseUrl`
 * workspace setting and the email/token from VS Code SecretStorage.
 * Returns null when any required value is missing or the base URL is unset.
 *
 * @param {vscode.ExtensionContext} context - The VS Code extension context
 * @returns {Promise<JiraCredentials | null>} Stored credentials, or null if incomplete
 * @version 1.1.1
 */
export async function getJiraCredentials(
  context: vscode.ExtensionContext
): Promise<JiraCredentials | null> {
  const config = vscode.workspace.getConfiguration('courier');
  const baseUrl = config.get<string>('jira.baseUrl')?.trim() ?? '';
  if (!baseUrl) return null;

  const email = await context.secrets.get(SECRET_EMAIL);
  const token = await context.secrets.get(SECRET_TOKEN);
  if (!email || !token) return null;

  return { baseUrl: normalizeBaseUrl(baseUrl), email, token };
}

/**
 * Persists Jira credentials: the base URL is written to the global VS Code
 * settings store and the email/token are stored in SecretStorage so they are
 * never written to disk in plain text.
 *
 * @param {vscode.ExtensionContext} context - The VS Code extension context
 * @param {JiraCredentials} creds - The credentials to persist
 * @returns {Promise<void>}
 * @version 1.1.1
 */
export async function saveJiraCredentials(
  context: vscode.ExtensionContext,
  creds: JiraCredentials
): Promise<void> {
  const config = vscode.workspace.getConfiguration('courier');
  await config.update('jira.baseUrl', normalizeBaseUrl(creds.baseUrl), vscode.ConfigurationTarget.Global);
  await context.secrets.store(SECRET_EMAIL, creds.email);
  await context.secrets.store(SECRET_TOKEN, creds.token);
}

/**
 * Normalizes a Jira base URL: trims surrounding whitespace, strips any
 * trailing slashes, and prepends `https://` when no scheme is present.
 *
 * @param {string} raw - Raw base URL string as entered by the user or from settings
 * @returns {string} Normalized URL without a trailing slash
 * @version 1.1.1
 */
export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

/**
 * Performs an authenticated HTTP/HTTPS request to the Jira REST API v2.
 * Uses Node's built-in `https`/`http` modules so no external libraries are
 * required. Resolves with the parsed JSON response on 2xx status codes;
 * rejects with a descriptive Error on any other status or network failure.
 *
 * @param {JiraCredentials} creds - Credentials used to build the Authorization header
 * @param {string} method - HTTP method (`"GET"`, `"POST"`, etc.)
 * @param {string} path - API path relative to the Jira base URL (e.g. `/rest/api/2/project`)
 * @param {unknown} [body] - Optional request body; will be JSON-serialized when provided
 * @returns {Promise<T>} Parsed JSON response body cast to the generic type T
 * @version 1.1.1
 */
function jiraRequest<T>(
  creds: JiraCredentials,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const base = new URL(creds.baseUrl);
    const auth = Buffer.from(`${creds.email}:${creds.token}`).toString('base64');
    const requestBody = body ? JSON.stringify(body) : undefined;

    const options: https.RequestOptions = {
      hostname: base.hostname,
      port: base.port || (base.protocol === 'https:' ? 443 : 80),
      path,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(requestBody
          ? { 'Content-Length': Buffer.byteLength(requestBody) }
          : {}),
      },
    };

    const lib = base.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        if (status >= 200 && status < 300) {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            resolve(data as unknown as T);
          }
        } else {
          let detail = data;
          try {
            const parsed = JSON.parse(data) as { errorMessages?: string[]; errors?: Record<string, string> };
            const msgs = parsed.errorMessages ?? [];
            const errs = Object.values(parsed.errors ?? {});
            detail = [...msgs, ...errs].join('; ') || data;
          } catch { /* keep raw body as detail */ }
          reject(new Error(`Jira API ${status}: ${detail}`));
        }
      });
    });

    req.on('error', reject);
    if (requestBody) req.write(requestBody);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Project listing
// ---------------------------------------------------------------------------

/**
 * Retrieves all Jira projects accessible to the authenticated user.
 * Returns a simplified array containing only the id, key, and name fields
 * needed for the project selection QuickPick.
 *
 * @param {JiraCredentials} creds - Valid Jira credentials
 * @returns {Promise<JiraProject[]>} Array of accessible projects
 * @version 1.1.1
 */
export async function listProjects(creds: JiraCredentials): Promise<JiraProject[]> {
  const projects = await jiraRequest<JiraProject[]>(creds, 'GET', '/rest/api/2/project');
  return projects.map((p) => ({ id: p.id, key: p.key, name: p.name }));
}

// ---------------------------------------------------------------------------
// Issue type listing
// ---------------------------------------------------------------------------

/**
 * Retrieves the non-subtask issue types available for a given Jira project.
 * Uses the `createmeta` endpoint with an expand query to fetch types in a
 * single request. Sub-task types are filtered out so they do not appear in
 * the QuickPick presented to the user.
 *
 * @param {JiraCredentials} creds - Valid Jira credentials
 * @param {string} projectKey - The Jira project key, e.g. `"PROJ"`
 * @returns {Promise<JiraIssueType[]>} Array of non-subtask issue types for the project
 * @version 1.1.1
 */
export async function listIssueTypes(
  creds: JiraCredentials,
  projectKey: string
): Promise<JiraIssueType[]> {
  type MetaProject = { issuetypes: JiraIssueType[] };
  type MetaResponse = { projects: MetaProject[] };

  const meta = await jiraRequest<MetaResponse>(
    creds,
    'GET',
    `/rest/api/2/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&expand=projects.issuetypes`
  );

  const project = meta.projects?.[0];
  if (!project) return [];

  return (project.issuetypes ?? [])
    .filter((t) => !t.subtask)
    .map((t) => ({ id: t.id, name: t.name, subtask: t.subtask }));
}

// ---------------------------------------------------------------------------
// Issue creation
// ---------------------------------------------------------------------------

/**
 * Creates a new Jira issue using the REST API v2 create endpoint.
 * Builds the `fields` object from the payload and includes optional
 * description, labels, priority, and assignee when provided. Returns the
 * Jira issue key, internal ID, and a browser-ready URL on success.
 *
 * @param {JiraCredentials} creds - Valid Jira credentials
 * @param {JiraIssuePayload} payload - All fields required for issue creation
 * @returns {Promise<CreateJiraIssueResult>} The created issue's key, ID, and URL
 * @version 1.1.1
 */
export async function createJiraIssue(
  creds: JiraCredentials,
  payload: JiraIssuePayload
): Promise<CreateJiraIssueResult> {
  type CreateResponse = { id: string; key: string; self: string };

  const fields: Record<string, unknown> = {
    project: { key: payload.projectKey },
    summary: payload.summary,
    issuetype: { name: payload.issueType },
  };

  if (payload.description) {
    fields.description = payload.description;
  }
  if (payload.labels?.length) {
    fields.labels = payload.labels;
  }
  if (payload.priority) {
    fields.priority = { name: payload.priority };
  }
  if (payload.assigneeEmail) {
    // Jira Cloud prefers accountId; the `name` field works for user-managed
    // accounts and is the standard approach for Jira Server / Data Center.
    fields.assignee = { name: payload.assigneeEmail };
  }

  const data = await jiraRequest<CreateResponse>(creds, 'POST', '/rest/api/2/issue', { fields });

  return {
    id: data.id,
    key: data.key,
    url: buildIssueUrl(creds.baseUrl, data.key),
  };
}

/**
 * Builds a browser-ready URL for a Jira issue using the project base URL
 * and the issue key (e.g. `PROJ-123`).
 *
 * @param {string} baseUrl - Jira instance base URL (normalized or raw)
 * @param {string} issueKey - Jira issue key, e.g. `"PROJ-123"`
 * @returns {string} Full URL to view the issue in a browser
 * @version 1.1.1
 */
export function buildIssueUrl(baseUrl: string, issueKey: string): string {
  return `${normalizeBaseUrl(baseUrl)}/browse/${issueKey}`;
}

// ---------------------------------------------------------------------------
// Credential validation
// ---------------------------------------------------------------------------

/**
 * Validates stored Jira credentials by performing a cheap authenticated GET
 * to the `/rest/api/2/myself` endpoint. Returns null on success or the error
 * message string when the request fails.
 *
 * @param {JiraCredentials} creds - The credentials to validate
 * @returns {Promise<string | null>} null on success, or an error message string
 * @version 1.1.1
 */
export async function validateJiraCredentials(
  creds: JiraCredentials
): Promise<string | null> {
  try {
    await jiraRequest(creds, 'GET', '/rest/api/2/myself');
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the Jira project key for the current ship operation.
 * Resolution priority: frontmatter `project:` field → session-level default
 * (set earlier in the same batch) → `courier.jira.defaultProject` setting →
 * interactive QuickPick populated from the live project list. Returns null
 * when the user cancels or no projects are available.
 *
 * @param {JiraCredentials} creds - Valid Jira credentials for fetching the live project list
 * @param {string | undefined} draftProject - Project key from frontmatter, if any
 * @param {string | undefined} sessionDefault - Project key already chosen earlier in the same batch
 * @returns {Promise<string | null>} Resolved project key, or null if unresolvable
 * @version 1.1.1
 */
export async function resolveJiraProject(
  creds: JiraCredentials,
  draftProject: string | undefined,
  sessionDefault: string | undefined
): Promise<string | null> {
  if (draftProject) return draftProject;
  if (sessionDefault) return sessionDefault;

  const config = vscode.workspace.getConfiguration('courier');
  const setting = config.get<string>('jira.defaultProject')?.trim();
  if (setting) return setting;

  // Fetch live project list for QuickPick.
  let projects: JiraProject[];
  try {
    projects = await listProjects(creds);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Courier: Could not fetch Jira projects — ${msg}`);
    return null;
  }

  if (!projects.length) {
    vscode.window.showErrorMessage('Courier: No Jira projects found for this account.');
    return null;
  }

  const items = projects.map((p) => ({
    label: p.key,
    description: p.name,
    key: p.key,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: 'Courier — Select Jira Project',
    placeHolder: 'Choose the project for this batch',
  });

  return picked?.key ?? null;
}

/**
 * Resolves the Jira issue type name for the current ship operation.
 * Resolution priority: frontmatter `issuetype:` field → session-level default
 * → `courier.jira.defaultIssueType` setting → interactive QuickPick populated
 * from the live issue-type list (falls back to Task/Story/Bug when the API
 * call fails). Returns null when the user cancels.
 *
 * @param {JiraCredentials} creds - Valid Jira credentials for fetching issue types
 * @param {string} projectKey - The resolved Jira project key
 * @param {string | undefined} draftIssueType - Issue type from frontmatter, if any
 * @param {string | undefined} sessionDefault - Issue type already chosen earlier in the same batch
 * @returns {Promise<string | null>} Resolved issue type name, or null if the user cancelled
 * @version 1.1.1
 */
export async function resolveJiraIssueType(
  creds: JiraCredentials,
  projectKey: string,
  draftIssueType: string | undefined,
  sessionDefault: string | undefined
): Promise<string | null> {
  if (draftIssueType) return draftIssueType;
  if (sessionDefault) return sessionDefault;

  const config = vscode.workspace.getConfiguration('courier');
  const setting = config.get<string>('jira.defaultIssueType')?.trim();
  if (setting) return setting;

  let types: JiraIssueType[];
  try {
    types = await listIssueTypes(creds, projectKey);
  } catch {
    // Fall back to common defaults if the meta endpoint fails.
    types = [
      { id: '1', name: 'Task', subtask: false },
      { id: '2', name: 'Story', subtask: false },
      { id: '3', name: 'Bug', subtask: false },
    ];
  }

  const items = types.map((t) => ({ label: t.name, name: t.name }));

  const picked = await vscode.window.showQuickPick(items, {
    title: `Courier — Select Issue Type for ${projectKey}`,
    placeHolder: 'Choose the issue type for this batch',
  });

  return picked?.name ?? null;
}
