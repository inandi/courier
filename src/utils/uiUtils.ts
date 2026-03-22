/**
 * Shared VS Code UI helpers used by multiple ship commands.
 */

import * as path from 'path';
import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// File confirmation QuickPick
// ---------------------------------------------------------------------------

/**
 * Show a QuickPick listing every candidate file with all items pre-selected.
 * The user can deselect individual files before confirming.
 * Returns the confirmed subset, or null if the user cancelled.
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
 * Create and immediately show a status bar spinner.
 * Caller is responsible for disposing it when the operation completes.
 *
 * @example
 * const bar = createShipStatusBar('Shipping 3 files…');
 * try { ... } finally { bar.dispose(); }
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
