/**
 * Courier File Utilities
 *
 * Helper functions for the Markdown draft file lifecycle: scanning the
 * workspace for `.md` files, reading their content, resolving the archive
 * folder path, moving processed files into a timestamped archive sub-folder,
 * and checking whether a file has already been archived to prevent duplicate
 * issue submissions.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Scans the given folder for `.md` files matching the supplied glob pattern.
 * The pattern is automatically made recursive when it does not start with `**`.
 * VS Code's `findFiles` API handles `.gitignore` and workspace exclusions.
 *
 * @param {vscode.Uri} folderUri - The folder to search within
 * @param {string} pattern - Glob pattern, e.g. `"*.md"` or `"**\/*.md"`
 * @returns {Promise<vscode.Uri[]>} Array of URIs for matched `.md` files
 * @version 1.1.1
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
 * Opens a Markdown file via VS Code's text-document API and returns its full
 * raw text content as a string. Using `openTextDocument` ensures the correct
 * encoding is applied and that any in-memory (unsaved) changes are included.
 *
 * @param {vscode.Uri} uri - URI of the file to read
 * @returns {Promise<string>} Full text content of the file
 * @version 1.1.1
 */
export async function readFileContent(uri: vscode.Uri): Promise<string> {
  const doc = await vscode.workspace.openTextDocument(uri);
  return doc.getText();
}

/**
 * Returns the absolute path of the archive folder for the given workspace.
 * The folder name is read from the `courier.archiveFolder` setting and
 * defaults to `_courier_processed` when the setting is unset.
 *
 * @param {string} workspaceRoot - Absolute path to the workspace root folder
 * @returns {string} Absolute path to the archive folder (may not yet exist)
 * @version 1.1.1
 */
export function getArchiveFolder(workspaceRoot: string): string {
  const config = vscode.workspace.getConfiguration('courier');
  const archive = config.get<string>('archiveFolder') ?? '_courier_processed';
  return path.join(workspaceRoot, archive);
}

/**
 * Moves a processed Markdown file into a timestamped sub-folder inside the
 * archive folder. The timestamp format is `YYYY-MM-DDTHH-MM-SS` (colons and
 * dots replaced to keep the path valid on all platforms). When an `issueUrl`
 * is supplied, a companion `.meta.json` file is written alongside the
 * archived draft containing the original source path and the created issue URL.
 *
 * @param {vscode.Uri} sourceUri - URI of the file to archive
 * @param {string} workspaceRoot - Absolute path to the workspace root folder
 * @param {string} [issueUrl] - Optional URL of the issue created from this file
 * @returns {Promise<vscode.Uri>} URI of the file at its new archived location
 * @version 1.1.1
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
 * Checks whether a file URI points inside the configured archive folder.
 * Used before processing to skip files that have already been shipped and
 * archived, preventing duplicate issue creation across repeated invocations.
 *
 * @param {vscode.Uri} fileUri - URI of the file to check
 * @param {string} workspaceRoot - Absolute path to the workspace root folder
 * @returns {boolean} True when the file resides inside the archive folder
 * @version 1.1.1
 */
export function isInArchive(fileUri: vscode.Uri, workspaceRoot: string): boolean {
  const archiveRoot = getArchiveFolder(workspaceRoot);
  return path.normalize(fileUri.fsPath).startsWith(path.normalize(archiveRoot));
}
