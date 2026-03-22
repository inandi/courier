/**
 * Courier Extension Main Module
 *
 * VS Code extension that ships Markdown (.md) draft files as GitHub issues
 * or Jira tickets directly from the editor. Registers all commands for both
 * platforms and wires them to their respective handlers.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import * as vscode from 'vscode';
import {
  shipFolderToGitHub,
  shipSelectedFiles,
  shipFilesFromExplorer,
} from './commands/shipToGitHub';
import { promptForGitHubToken } from './providers/githubProvider';
import {
  shipFolderToJira,
  shipSelectedFilesToJira,
  shipFileToJiraFromExplorer,
  promptAndSaveJiraCredentials,
} from './commands/shipToJira';

/**
 * Activates the Courier extension.
 * Registers all GitHub and Jira ship commands and binds them to their
 * respective handlers. Each command is pushed to context.subscriptions so
 * VS Code disposes them automatically on deactivation.
 *
 * @param {vscode.ExtensionContext} context - The VS Code extension context
 * @returns {void}
 * @version 1.1.1
 */
export function activate(context: vscode.ExtensionContext): void {
  // -------------------------------------------------------------------------
  // GitHub commands
  // -------------------------------------------------------------------------

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'courier.shipFolderToGitHub',
      () => shipFolderToGitHub(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'courier.shipSelectedFiles',
      () => shipSelectedFiles(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'courier.shipFilesFromExplorer',
      (resource: vscode.Uri) => shipFilesFromExplorer(context, resource)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('courier.configureGitHubToken', async () => {
      const token = await promptForGitHubToken(context);
      if (token) {
        vscode.window.showInformationMessage(
          'Courier: GitHub authentication configured successfully.'
        );
      }
    })
  );

  // -------------------------------------------------------------------------
  // Jira commands
  // -------------------------------------------------------------------------

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'courier.shipFolderToJira',
      () => shipFolderToJira(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'courier.shipSelectedFilesToJira',
      () => shipSelectedFilesToJira(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'courier.shipFileToJiraFromExplorer',
      (resource: vscode.Uri) => shipFileToJiraFromExplorer(context, resource)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('courier.configureJira', async () => {
      const creds = await promptAndSaveJiraCredentials(context);
      if (creds) {
        vscode.window.showInformationMessage(
          'Courier: Jira credentials saved successfully.'
        );
      }
    })
  );
}

/**
 * Deactivates the Courier extension.
 * No explicit cleanup is required — all command subscriptions registered
 * in activate() are disposed automatically by VS Code.
 *
 * @returns {void}
 * @version 1.1.1
 */
export function deactivate(): void {}
