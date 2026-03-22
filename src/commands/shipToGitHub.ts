/**
 * Ship .md files to GitHub as issues
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

export interface ShipResult {
  file: string;
  success: boolean;
  url?: string;
  issueNumber?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Core shipping logic
// ---------------------------------------------------------------------------

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

function showSummary(results: ShipResult[], repoSlug: string) {
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

export async function shipFolderToGitHub(context: vscode.ExtensionContext) {
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

export async function shipSelectedFiles(context: vscode.ExtensionContext) {
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

  // Let the user confirm / deselect before shipping.
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
 * Ship file from the explorer context menu (right-click on a .md file).
 */
export async function shipFilesFromExplorer(
  context: vscode.ExtensionContext,
  resource: vscode.Uri
) {
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
