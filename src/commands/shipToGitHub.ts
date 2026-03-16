/**
 * Ship .md files to GitHub as issues
 */

import * as vscode from 'vscode';
import { resolveTemplate, parseWithTemplate, ParsedDraft } from '../parser';
import {
  isGhAuthenticated,
  createIssueViaGh,
  createIssueViaApi,
  getGitHubToken,
  resolveRepo,
  CreateIssueResult,
} from '../providers/githubProvider';
import {
  findMdFiles,
  readFileContent,
  moveToArchive,
  isInArchive,
} from '../utils/fileUtils';

export interface ShipResult {
  file: string;
  success: boolean;
  url?: string;
  error?: string;
}

async function createIssue(
  repo: { owner: string; repo: string },
  draft: ParsedDraft,
  workspaceRoot: string,
  context: vscode.ExtensionContext
): Promise<CreateIssueResult> {
  const useGh = await isGhAuthenticated();
  if (useGh) {
    return createIssueViaGh(repo, draft.title, draft.body, workspaceRoot);
  }

  const token = await getGitHubToken(context);
  if (!token) {
    throw new Error(
      'GitHub token required. Run "Courier: Configure GitHub Token" or install and authenticate gh CLI.'
    );
  }
  return createIssueViaApi(repo, draft.title, draft.body, token);
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

  for (const uri of fileUris) {
    if (isInArchive(uri, workspaceRoot)) {
      results.push({
        file: uri.fsPath,
        success: false,
        error: 'File is already in archive (already shipped)',
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
          error: 'Empty or invalid file',
        });
        continue;
      }

      const issue = await createIssue(repo, draft, workspaceRoot, context);
      await moveToArchive(uri, workspaceRoot, issue.url);
      results.push({
        file: uri.fsPath,
        success: true,
        url: issue.url,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        file: uri.fsPath,
        success: false,
        error: msg,
      });
    }
  }

  return results;
}

function showSummary(results: ShipResult[]) {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (succeeded.length > 0) {
    vscode.window.showInformationMessage(
      `Courier: Shipped ${succeeded.length} file(s) to GitHub. ${succeeded.map((r) => r.url).join(', ')}`
    );
  }
  if (failed.length > 0) {
    const details = failed.map((r) => `${r.file}: ${r.error}`).join('\n');
    vscode.window.showErrorMessage(
      `Courier: ${failed.length} file(s) failed:\n${details}`
    );
  }
}

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
  const files = await findMdFiles(folderUri, pattern);

  if (files.length === 0) {
    vscode.window.showInformationMessage(
      `Courier: No .md files found in ${folderUri.fsPath}`
    );
    return;
  }

  const workspaceRoot = vscode.workspace.getWorkspaceFolder(folderUri)!.uri
    .fsPath;
  const results = await shipFiles(files, workspaceRoot, context);
  showSummary(results);
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

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(files[0]);
  const workspaceRoot = workspaceFolder?.uri.fsPath ?? workspaceFolders[0].uri.fsPath;
  const results = await shipFiles(files, workspaceRoot, context);
  showSummary(results);
}

/**
 * Ship file from explorer context menu (right-click). Receives the right-clicked resource.
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

  const results = await shipFiles(
    [resource],
    workspaceFolder.uri.fsPath,
    context
  );
  showSummary(results);
}
