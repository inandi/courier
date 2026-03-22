/**
 * Jira Cloud integration via REST API v2.
 * Auth: Basic auth (email + API token). No external libraries — uses Node https.
 */

import * as https from 'https';
import * as http from 'http';
import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JiraCredentials {
  baseUrl: string;
  email: string;
  token: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

export interface JiraIssuePayload {
  projectKey: string;
  summary: string;
  description?: string;
  issueType: string;
  labels?: string[];
  assigneeEmail?: string;
  priority?: string;
}

export interface CreateJiraIssueResult {
  id: string;
  key: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

const SECRET_EMAIL = 'courier.jira.email';
const SECRET_TOKEN = 'courier.jira.token';

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

export async function saveJiraCredentials(
  context: vscode.ExtensionContext,
  creds: JiraCredentials
): Promise<void> {
  const config = vscode.workspace.getConfiguration('courier');
  await config.update('jira.baseUrl', normalizeBaseUrl(creds.baseUrl), vscode.ConfigurationTarget.Global);
  await context.secrets.store(SECRET_EMAIL, creds.email);
  await context.secrets.store(SECRET_TOKEN, creds.token);
}

/** Strip trailing slash and ensure https:// prefix is present. */
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
          } catch { /* keep raw */ }
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

export async function listProjects(creds: JiraCredentials): Promise<JiraProject[]> {
  const projects = await jiraRequest<JiraProject[]>(creds, 'GET', '/rest/api/2/project');
  return projects.map((p) => ({ id: p.id, key: p.key, name: p.name }));
}

// ---------------------------------------------------------------------------
// Issue type listing
// ---------------------------------------------------------------------------

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
    // Jira Cloud: assignee by accountId is preferred, but email lookup
    // works for user-managed accounts. Use the name field for Server/DC.
    fields.assignee = { name: payload.assigneeEmail };
  }

  const data = await jiraRequest<CreateResponse>(creds, 'POST', '/rest/api/2/issue', { fields });

  return {
    id: data.id,
    key: data.key,
    url: buildIssueUrl(creds.baseUrl, data.key),
  };
}

/** Build a browser URL for a Jira issue key. */
export function buildIssueUrl(baseUrl: string, issueKey: string): string {
  return `${normalizeBaseUrl(baseUrl)}/browse/${issueKey}`;
}

// ---------------------------------------------------------------------------
// Credential validation
// ---------------------------------------------------------------------------

/** Attempt a cheap API call to verify credentials. Returns error message or null. */
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
 * Resolve the Jira project key for a given draft.
 * Priority: frontmatter → workspace setting → QuickPick.
 * Returns null if the user cancels.
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
 * Resolve the Jira issue type for a given project.
 * Priority: frontmatter → workspace setting → QuickPick.
 * Returns null if the user cancels.
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
