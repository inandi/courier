/**
 * Courier Ship-to-GitHub Command
 *
 * Implements the three GitHub issue-creation entry points exposed to VS Code:
 * shipping all `.md` files found in a folder, shipping a user-selected set of
 * files via an open dialog, and shipping a single file right-clicked in the
 * Explorer. All paths converge on the shared `shipFiles` core function which
 * parses each draft, calls the GitHub REST API, archives the file, and
 * reports a summary notification to the user.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { resolveTemplate, parseWithTemplate, ParsedDraft } from '../parser';
import {
  createIssueViaApi,
  getGitHubToken,
  resolveRepo,
  CreateIssueResult,
  IssueMetadata,
} from '../providers/githubProvider';
import {
  findMdFiles,
  readFileContent,
  moveToArchive,
  isInArchive,
} from '../utils/fileUtils';
import { confirmFiles, createShipStatusBar } from '../utils/uiUtils';

/**
 * Represents the outcome of attempting to ship a single `.md` file to GitHub.
 * Accumulated into an array by the core shipping function and consumed by
 * the summary notification helper.
 *
 * @version 1.1.1
 */
export interface ShipResult {
  /** Absolute path of the source file. */
  file: string;
  /** True when the GitHub issue was created and the file was archived. */
  success: boolean;
  /** Browser URL of the created issue (populated on success). */
  url?: string;
  /** Sequential GitHub issue number (populated on success). */
  issueNumber?: number;
  /** Human-readable error description (populated on failure). */
  error?: string;
}

// ---------------------------------------------------------------------------
// Core shipping logic
// ---------------------------------------------------------------------------

/**
 * Authenticates with GitHub and creates a single issue for the given draft.
 * Throws when no token is available so the caller can record the error and
 * continue processing remaining files.
 *
 * @param {{ owner: string; repo: string }} repo - Target GitHub repository
 * @param {ParsedDraft} draft - Parsed title, body, and optional metadata
 * @param {vscode.ExtensionContext} context - VS Code extension context for token retrieval
 * @returns {Promise<CreateIssueResult>} The created issue URL and number
 * @version 1.1.1
 */
async function createIssue(
  repo: { owner: string; repo: string },
  draft: ParsedDraft,
  context: vscode.ExtensionContext
): Promise<CreateIssueResult> {
  const token = await getGitHubToken(context);
  if (!token) {
    throw new Error(
      'Not authenticated with GitHub. Sign in via the "Courier: Sign in to GitHub" command, or run "Courier: Configure GitHub Token" to store a Personal Access Token.'
    );
  }
  const meta: IssueMetadata = {
    labels: draft.labels,
    assignees: draft.assignees,
    milestone: draft.milestone,
  };
  return createIssueViaApi(repo, draft.title, draft.body, token, meta);
}

/**
 * Processes an array of `.md` file URIs: resolves the target GitHub repo,
 * applies the workspace template to parse each file, creates a GitHub issue,
 * and archives the source file. A spinning status bar item is shown for the
 * entire duration. Files already in the archive or that cannot be parsed are
 * recorded as failures without aborting the remaining files.
 *
 * @param {vscode.Uri[]} fileUris - Confirmed `.md` files to ship
 * @param {string} workspaceRoot - Absolute path to the workspace root folder
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @returns {Promise<ShipResult[]>} Per-file results including success/failure details
 * @version 1.1.1
 */
async function shipFiles(
  fileUris: vscode.Uri[],
  workspaceRoot: string,
  context: vscode.ExtensionContext
): Promise<ShipResult[]> {
  const repo = await resolveRepo(workspaceRoot, context);
  if (!repo) {
    vscode.window.showWarningMessage('Courier: No GitHub repo selected. Cancelled.');
    return [];
  }

  const template = resolveTemplate(workspaceRoot);
  const results: ShipResult[] = [];

  // Status bar spinner — visible for the entire background run.
  const statusBar = createShipStatusBar(`shipping ${fileUris.length} file(s)…`);

  try {
    for (const uri of fileUris) {
      const fileName = path.basename(uri.fsPath);
      statusBar.text = `$(sync~spin) Courier: ${fileName}…`;

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
          results.push({
            file: uri.fsPath,
            success: false,
            error: 'Empty or invalid file — skipped',
          });
          continue;
        }

        const issue = await createIssue(repo, draft, context);
        await moveToArchive(uri, workspaceRoot, issue.url);
        results.push({
          file: uri.fsPath,
          success: true,
          url: issue.url,
          issueNumber: issue.number,
        });
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
 * Displays a VS Code notification summarising the completed ship operation.
 * Successful issues are listed by number with an "Open on GitHub" action that
 * opens the first issue in the default browser. Failures are shown in a
 * separate error message listing the file name and error detail for each.
 *
 * @param {ShipResult[]} results - Per-file results from the ship operation
 * @param {string} repoSlug - Repository identifier string shown in the message, e.g. `owner/repo`
 * @returns {void}
 * @version 1.1.1
 */
function showSummary(results: ShipResult[], repoSlug: string): void {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (succeeded.length > 0) {
    const links = succeeded
      .map((r) => `#${r.issueNumber}`)
      .join(', ');
    vscode.window
      .showInformationMessage(
        `Courier: ${succeeded.length} issue(s) created in ${repoSlug} — ${links}`,
        'Open on GitHub'
      )
      .then((action) => {
        if (action === 'Open on GitHub' && succeeded[0].url) {
          vscode.env.openExternal(vscode.Uri.parse(succeeded[0].url));
        }
      });
  }

  if (failed.length > 0) {
    const details = failed.map((r) => `• ${path.basename(r.file)}: ${r.error}`).join('\n');
    vscode.window.showErrorMessage(
      `Courier: ${failed.length} file(s) failed.\n${details}`
    );
  }
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Entry point for the `courier.shipFolderToGitHub` command.
 * Scans the workspace source folder (or the root when `courier.sourceFolder`
 * is unset) for `.md` files matching `courier.filePattern`, presents a
 * multi-select QuickPick for confirmation, and ships the selected files.
 *
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @returns {Promise<void>}
 * @version 1.1.1
 */
export async function shipFolderToGitHub(context: vscode.ExtensionContext): Promise<void> {
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
    vscode.window.showInformationMessage(
      `Courier: No .md files found in ${folderUri.fsPath}`
    );
    return;
  }

  const confirmed = await confirmFiles(found, 'Courier — Create GitHub Issues');
  if (!confirmed) return;

  const workspaceRoot = vscode.workspace.getWorkspaceFolder(folderUri)!.uri.fsPath;
  const repo = await resolveRepo(workspaceRoot, context);
  const repoSlug = repo ? `${repo.owner}/${repo.repo}` : 'GitHub';

  const results = await shipFiles(confirmed, workspaceRoot, context);
  showSummary(results, repoSlug);
}

/**
 * Entry point for the `courier.shipSelectedFiles` command.
 * Opens a file picker filtered to `.md` files, presents the selection in a
 * confirmation QuickPick, and ships the confirmed files to GitHub.
 *
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @returns {Promise<void>}
 * @version 1.1.1
 */
export async function shipSelectedFiles(context: vscode.ExtensionContext): Promise<void> {
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

  const confirmed = await confirmFiles(files, 'Courier — Create GitHub Issues');
  if (!confirmed) return;

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(files[0]);
  const workspaceRoot =
    workspaceFolder?.uri.fsPath ?? workspaceFolders[0].uri.fsPath;
  const repo = await resolveRepo(workspaceRoot, context);
  const repoSlug = repo ? `${repo.owner}/${repo.repo}` : 'GitHub';

  const results = await shipFiles(confirmed, workspaceRoot, context);
  showSummary(results, repoSlug);
}

/**
 * Entry point for the `courier.shipFilesFromExplorer` command.
 * Triggered via the Explorer context menu when the user right-clicks a `.md`
 * file. Shows a single-item confirmation QuickPick then ships the file.
 *
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {vscode.Uri} resource - URI of the file activated from the Explorer
 * @returns {Promise<void>}
 * @version 1.1.1
 */
export async function shipFilesFromExplorer(
  context: vscode.ExtensionContext,
  resource: vscode.Uri
): Promise<void> {
  if (!resource.fsPath.endsWith('.md')) {
    vscode.window.showWarningMessage('Courier: Select a .md file to ship.');
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(resource);
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolder || !workspaceFolders?.length) {
    vscode.window.showErrorMessage('Courier: File must be in a workspace.');
    return;
  }

  const confirmed = await confirmFiles([resource], 'Courier — Create GitHub Issue');
  if (!confirmed) return;

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const repo = await resolveRepo(workspaceRoot, context);
  const repoSlug = repo ? `${repo.owner}/${repo.repo}` : 'GitHub';

  const results = await shipFiles(confirmed, workspaceRoot, context);
  showSummary(results, repoSlug);
}
