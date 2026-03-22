/**
 * Courier - Ship GitHub issues from .md files
 */

import * as vscode from 'vscode';
import {
  shipFolderToGitHub,
  shipSelectedFiles,
  shipFilesFromExplorer,
} from './commands/shipToGitHub';
import { promptForGitHubToken } from './providers/githubProvider';

export function activate(context: vscode.ExtensionContext) {
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
      (resource: vscode.Uri) => {
        shipFilesFromExplorer(context, resource);
      }
    )
  );

  // Sign in via VS Code GitHub OAuth or store a PAT as fallback.
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
}

export function deactivate() {}
