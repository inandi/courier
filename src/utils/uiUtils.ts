/**
 * Courier UI Utilities
 *
 * Shared VS Code user-interface helpers used by both the GitHub and Jira
 * ship commands. Centralising these components avoids code duplication and
 * ensures a consistent look and feel across all shipping flows:
 * a multi-select QuickPick for file confirmation and a status bar spinner
 * for background operations.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import * as path from 'path';
import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// File confirmation QuickPick
// ---------------------------------------------------------------------------

/**
 * Presents a multi-select QuickPick listing every candidate `.md` file with
 * all items pre-checked. The user can deselect individual files before
 * pressing Enter to confirm. Returns the confirmed subset of URIs, or null
 * when the user presses Escape or deselects everything.
 *
 * @param {vscode.Uri[]} fileUris - Candidate file URIs to display in the picker
 * @param {string} [title] - Optional QuickPick title shown at the top of the panel
 * @returns {Promise<vscode.Uri[] | null>} Selected file URIs, or null if cancelled
 * @version 1.1.1
 */
export async function confirmFiles(
  fileUris: vscode.Uri[],
  title = 'Courier — Select files to ship'
): Promise<vscode.Uri[] | null> {
  const items = fileUris.map((uri) => ({
    label: `$(markdown) ${path.basename(uri.fsPath)}`,
    description: vscode.workspace.asRelativePath(uri.fsPath),
    uri,
    picked: true,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title,
    placeHolder: `${fileUris.length} file(s) found. Deselect any to skip, then press Enter.`,
  });

  if (!picked) return null;
  if (picked.length === 0) {
    vscode.window.showInformationMessage('Courier: No files selected.');
    return null;
  }
  return picked.map((item) => item.uri);
}

// ---------------------------------------------------------------------------
// Status bar spinner
// ---------------------------------------------------------------------------

/**
 * Creates and immediately shows a spinning status bar item at the left side
 * of the VS Code status bar to communicate that a background operation is in
 * progress. The caller is responsible for calling `dispose()` when the
 * operation completes so the spinner is removed.
 *
 * @example
 * const bar = createShipStatusBar('Shipping 3 files…');
 * try {
 *   await doLongOperation();
 * } finally {
 *   bar.dispose();
 * }
 *
 * @param {string} message - Short description appended to the "Courier:" prefix
 * @returns {vscode.StatusBarItem} The active status bar item (must be disposed by caller)
 * @version 1.1.1
 */
export function createShipStatusBar(message: string): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  item.text = `$(sync~spin) Courier: ${message}`;
  item.show();
  return item;
}
