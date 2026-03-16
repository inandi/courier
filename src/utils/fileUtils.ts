/**
 * File scanning and archive utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Find .md files matching the glob pattern in the given folder
 */
export async function findMdFiles(
  folderUri: vscode.Uri,
  pattern: string
): Promise<vscode.Uri[]> {
  const relPattern = pattern.startsWith('**') ? pattern : `**/${pattern}`;
  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(folderUri, relPattern),
    null
  );
  return files.filter((u) => u.fsPath.endsWith('.md'));
}

/**
 * Read file content as string
 */
export async function readFileContent(uri: vscode.Uri): Promise<string> {
  const doc = await vscode.workspace.openTextDocument(uri);
  return doc.getText();
}

/**
 * Get archive folder path (relative to workspace root)
 */
export function getArchiveFolder(workspaceRoot: string): string {
  const config = vscode.workspace.getConfiguration('courier');
  const archive = config.get<string>('archiveFolder') ?? '_courier_processed';
  return path.join(workspaceRoot, archive);
}

/**
 * Move file to archive. Creates timestamped subfolder.
 * Returns the destination path.
 */
export async function moveToArchive(
  sourceUri: vscode.Uri,
  workspaceRoot: string,
  issueUrl?: string
): Promise<vscode.Uri> {
  const archiveRoot = getArchiveFolder(workspaceRoot);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archiveDir = path.join(archiveRoot, timestamp);
  const fileName = path.basename(sourceUri.fsPath);
  const destPath = path.join(archiveDir, fileName);

  await fs.promises.mkdir(archiveDir, { recursive: true });
  await fs.promises.rename(sourceUri.fsPath, destPath);

  if (issueUrl) {
    const metaPath = destPath + '.meta.json';
    await fs.promises.writeFile(
      metaPath,
      JSON.stringify({ source: sourceUri.fsPath, issueUrl }, null, 2)
    );
  }

  return vscode.Uri.file(destPath);
}

/**
 * Check if file is already in archive (to avoid double-post)
 */
export function isInArchive(fileUri: vscode.Uri, workspaceRoot: string): boolean {
  const archiveRoot = getArchiveFolder(workspaceRoot);
  return path.normalize(fileUri.fsPath).startsWith(path.normalize(archiveRoot));
}
