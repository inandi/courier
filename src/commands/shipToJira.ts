/**
 * Courier Ship-to-Jira Command
 *
 * Implements the three Jira ticket-creation entry points exposed to VS Code:
 * shipping all `.md` files in a folder, shipping a user-selected set of files
 * via an open dialog, and shipping a single file right-clicked in the Explorer.
 * Also provides the interactive credential-setup flow used by the
 * `courier.configureJira` command. All shipping paths converge on the shared
 * `shipFilesToJira` core function which resolves project/issue-type once per
 * batch, creates each ticket via the Jira REST API, archives the source file,
 * and reports a summary notification.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { resolveTemplate, parseWithTemplate } from '../parser';
import {
  getJiraCredentials,
  saveJiraCredentials,
  validateJiraCredentials,
  createJiraIssue,
  resolveJiraProject,
  resolveJiraIssueType,
  JiraCredentials,
} from '../providers/jiraProvider';
import {
  findMdFiles,
  readFileContent,
  moveToArchive,
  isInArchive,
} from '../utils/fileUtils';
import { confirmFiles, createShipStatusBar } from '../utils/uiUtils';

/**
 * Represents the outcome of attempting to ship a single `.md` file to Jira.
 * Accumulated into an array by the core shipping function and consumed by
 * the summary notification helper.
 *
 * @version 1.1.1
 */
export interface ShipJiraResult {
  /** Absolute path of the source file. */
  file: string;
  /** True when the Jira ticket was created and the file was archived. */
  success: boolean;
  /** Jira issue key in `PROJECT-123` format (populated on success). */
  key?: string;
  /** Browser URL of the created ticket (populated on success). */
  url?: string;
  /** Human-readable error description (populated on failure). */
  error?: string;
}

// ---------------------------------------------------------------------------
// Credential prompting
// ---------------------------------------------------------------------------

/**
 * Interactively guides the user through setting up Jira credentials.
 * Prompts for the Jira base URL, account email, and API token via three
 * sequential InputBox dialogs. Validates the credentials against the
 * `/rest/api/2/myself` endpoint before persisting them to VS Code's
 * SecretStorage and global settings. Returns null when the user cancels any
 * step or when validation fails.
 *
 * @param {vscode.ExtensionContext} context - VS Code extension context for credential storage
 * @returns {Promise<JiraCredentials | null>} The validated and saved credentials, or null
 * @version 1.1.1
 */
export async function promptAndSaveJiraCredentials(
  context: vscode.ExtensionContext
): Promise<JiraCredentials | null> {
  const baseUrl = await vscode.window.showInputBox({
    title: 'Courier — Jira: Base URL',
    prompt: 'Your Jira Cloud instance URL',
    placeHolder: 'https://mycompany.atlassian.net',
    validateInput: (v) =>
      v.trim().length > 0 ? null : 'Base URL is required',
  });
  if (!baseUrl) return null;

  const email = await vscode.window.showInputBox({
    title: 'Courier — Jira: Email',
    prompt: 'The email address of your Atlassian account',
    placeHolder: 'you@example.com',
    validateInput: (v) => (v.includes('@') ? null : 'Enter a valid email address'),
  });
  if (!email) return null;

  const token = await vscode.window.showInputBox({
    title: 'Courier — Jira: API Token',
    prompt: 'Your Jira API token (create one at id.atlassian.com/manage-profile/security/api-tokens)',
    password: true,
    placeHolder: 'ATATT3xFfGF0…',
    validateInput: (v) => (v.trim().length > 0 ? null : 'API token is required'),
  });
  if (!token) return null;

  const creds: JiraCredentials = { baseUrl: baseUrl.trim(), email: email.trim(), token: token.trim() };

  // Validate before storing.
  const validating = createShipStatusBar('validating Jira credentials…');
  const error = await validateJiraCredentials(creds).finally(() => validating.dispose());

  if (error) {
    vscode.window.showErrorMessage(
      `Courier: Jira credentials are invalid — ${error}. Check the URL, email, and token then try again.`
    );
    return null;
  }

  await saveJiraCredentials(context, creds);
  return creds;
}

// ---------------------------------------------------------------------------
// Core shipping logic
// ---------------------------------------------------------------------------

/**
 * Processes an array of `.md` file URIs: retrieves (or prompts for) Jira
 * credentials, resolves a session-level project key and issue type once for
 * all files that do not specify their own via frontmatter, then iterates
 * through each file — parsing, creating a Jira ticket, and archiving.
 * A spinning status bar item is shown throughout. Files already archived or
 * that cannot be parsed are recorded as failures without halting the batch.
 *
 * @param {vscode.Uri[]} fileUris - Confirmed `.md` files to ship
 * @param {string} workspaceRoot - Absolute path to the workspace root folder
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @returns {Promise<ShipJiraResult[]>} Per-file results including success/failure details
 * @version 1.1.1
 */
async function shipFilesToJira(
  fileUris: vscode.Uri[],
  workspaceRoot: string,
  context: vscode.ExtensionContext
): Promise<ShipJiraResult[]> {
  let creds = await getJiraCredentials(context);
  if (!creds) {
    const action = await vscode.window.showWarningMessage(
      'Courier: Jira credentials not configured.',
      'Configure Now'
    );
    if (action !== 'Configure Now') return [];
    creds = await promptAndSaveJiraCredentials(context);
    if (!creds) return [];
  }

  const template = resolveTemplate(workspaceRoot);
  const results: ShipJiraResult[] = [];

  // Resolve a session-level default project and issue type — ask once,
  // use for all files that don't specify their own in frontmatter.
  let sessionProject: string | undefined;
  let sessionIssueType: string | undefined;

  // Pre-scan: check if any file needs a project/issue-type prompt.
  const needsProjectPrompt = fileUris.some(async (uri) => {
    const content = await readFileContent(uri);
    const draft = parseWithTemplate(content, template);
    return !draft?.project;
  });

  if (needsProjectPrompt) {
    const resolved = await resolveJiraProject(creds, undefined, undefined);
    if (!resolved) {
      vscode.window.showWarningMessage('Courier: No Jira project selected. Cancelled.');
      return [];
    }
    sessionProject = resolved;
    const resolvedType = await resolveJiraIssueType(creds, sessionProject, undefined, undefined);
    if (!resolvedType) {
      vscode.window.showWarningMessage('Courier: No issue type selected. Cancelled.');
      return [];
    }
    sessionIssueType = resolvedType;
  }

  const statusBar = createShipStatusBar(`shipping ${fileUris.length} file(s) to Jira…`);

  try {
    for (const uri of fileUris) {
      const fileName = path.basename(uri.fsPath);
      statusBar.text = `$(sync~spin) Courier: ${fileName} → Jira…`;

      if (isInArchive(uri, workspaceRoot)) {
        results.push({
          file: uri.fsPath,
          success: false,
          error: 'Already shipped (file is in archive)',
        });
        continue;
      }

      try {
        const content = await readFileContent(uri);
        const draft = parseWithTemplate(content, template);
        if (!draft) {
          results.push({ file: uri.fsPath, success: false, error: 'Empty or invalid file — skipped' });
          continue;
        }

        // Per-file project/type (from frontmatter) override session defaults.
        const projectKey = draft.project ?? sessionProject;
        const issueType = draft.issuetype ?? sessionIssueType;

        if (!projectKey || !issueType) {
          results.push({ file: uri.fsPath, success: false, error: 'No Jira project or issue type resolved' });
          continue;
        }

        const issue = await createJiraIssue(creds!, {
          projectKey,
          summary: draft.title,
          description: draft.body || undefined,
          issueType,
          labels: draft.labels,
          assigneeEmail: draft.assignees?.[0],
          priority: draft.priority,
        });

        await moveToArchive(uri, workspaceRoot, issue.url);
        results.push({ file: uri.fsPath, success: true, key: issue.key, url: issue.url });
      } catch (err) {
        results.push({
          file: uri.fsPath,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    statusBar.dispose();
  }

  return results;
}

// ---------------------------------------------------------------------------
// Summary notification
// ---------------------------------------------------------------------------

/**
 * Displays a VS Code notification summarising the completed Jira ship operation.
 * Successful tickets are listed by their issue key with an "Open in Browser"
 * action. Failures are shown in a separate error message listing the file name
 * and error detail for each.
 *
 * @param {ShipJiraResult[]} results - Per-file results from the ship operation
 * @returns {void}
 * @version 1.1.1
 */
function showJiraSummary(results: ShipJiraResult[]): void {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (succeeded.length > 0) {
    const keys = succeeded.map((r) => r.key).join(', ');
    vscode.window
      .showInformationMessage(
        `Courier: ${succeeded.length} Jira ticket(s) created — ${keys}`,
        'Open in Browser'
      )
      .then((action) => {
        if (action === 'Open in Browser' && succeeded[0].url) {
          vscode.env.openExternal(vscode.Uri.parse(succeeded[0].url));
        }
      });
  }

  if (failed.length > 0) {
    const details = failed.map((r) => `• ${path.basename(r.file)}: ${r.error}`).join('\n');
    vscode.window.showErrorMessage(`Courier: ${failed.length} file(s) failed.\n${details}`);
  }
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Entry point for the `courier.shipFolderToJira` command.
 * Scans the workspace source folder (or the root when `courier.sourceFolder`
 * is unset) for `.md` files matching `courier.filePattern`, presents a
 * multi-select QuickPick for confirmation, then ships the selected files.
 *
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @returns {Promise<void>}
 * @version 1.1.1
 */
export async function shipFolderToJira(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    vscode.window.showErrorMessage('Courier: No workspace folder open.');
    return;
  }

  let folderUri: vscode.Uri;
  if (workspaceFolders.length === 1) {
    const config = vscode.workspace.getConfiguration('courier');
    const sourceFolder = config.get<string>('sourceFolder');
    folderUri = sourceFolder
      ? vscode.Uri.joinPath(workspaceFolders[0].uri, sourceFolder)
      : workspaceFolders[0].uri;
  } else {
    const picked = await vscode.window.showWorkspaceFolderPick();
    if (!picked) return;
    folderUri = picked.uri;
  }

  const config = vscode.workspace.getConfiguration('courier');
  const pattern = config.get<string>('filePattern') ?? '**/*.md';
  const found = await findMdFiles(folderUri, pattern);

  if (found.length === 0) {
    vscode.window.showInformationMessage(`Courier: No .md files found in ${folderUri.fsPath}`);
    return;
  }

  const confirmed = await confirmFiles(found, 'Courier — Create Jira Tickets');
  if (!confirmed) return;

  const workspaceRoot = vscode.workspace.getWorkspaceFolder(folderUri)!.uri.fsPath;
  const results = await shipFilesToJira(confirmed, workspaceRoot, context);
  showJiraSummary(results);
}

/**
 * Entry point for the `courier.shipSelectedFilesToJira` command.
 * Opens a file picker filtered to `.md` files, presents the selection in a
 * confirmation QuickPick, and ships the confirmed files to Jira.
 *
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @returns {Promise<void>}
 * @version 1.1.1
 */
export async function shipSelectedFilesToJira(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    vscode.window.showErrorMessage('Courier: No workspace folder open.');
    return;
  }

  const files = await vscode.window.showOpenDialog({
    canSelectMany: true,
    filters: { Markdown: ['md'] },
    defaultUri: workspaceFolders[0].uri,
  });

  if (!files?.length) return;

  const confirmed = await confirmFiles(files, 'Courier — Create Jira Tickets');
  if (!confirmed) return;

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(files[0]);
  const workspaceRoot = workspaceFolder?.uri.fsPath ?? workspaceFolders[0].uri.fsPath;
  const results = await shipFilesToJira(confirmed, workspaceRoot, context);
  showJiraSummary(results);
}

/**
 * Entry point for the `courier.shipFileToJiraFromExplorer` command.
 * Triggered via the Explorer context menu when the user right-clicks a `.md`
 * file. Shows a single-item confirmation QuickPick then ships the file to Jira.
 *
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {vscode.Uri} resource - URI of the file activated from the Explorer
 * @returns {Promise<void>}
 * @version 1.1.1
 */
export async function shipFileToJiraFromExplorer(
  context: vscode.ExtensionContext,
  resource: vscode.Uri
): Promise<void> {
  if (!resource.fsPath.endsWith('.md')) {
    vscode.window.showWarningMessage('Courier: Select a .md file to ship.');
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(resource);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Courier: File must be in a workspace.');
    return;
  }

  const confirmed = await confirmFiles([resource], 'Courier — Create Jira Ticket');
  if (!confirmed) return;

  const results = await shipFilesToJira(confirmed, workspaceFolder.uri.fsPath, context);
  showJiraSummary(results);
}
