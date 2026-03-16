/**
 * Courier - Ship GitHub issues, Jira tickets, Slack notifications from .md files
 */

import * as vscode from 'vscode';
import {
  shipFolderToGitHub,
  shipSelectedFiles,
  shipFilesFromExplorer,
} from './commands/shipToGitHub';

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

  context.subscriptions.push(
    vscode.commands.registerCommand('courier.configureGitHubToken', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your GitHub Personal Access Token',
        password: true,
        placeHolder: 'ghp_xxxxxxxxxxxx',
        validateInput: (v) =>
          v.trim().length > 0 ? null : 'Token is required',
      });
      if (token) {
        await context.secrets.store('courier.github.token', token.trim());
        vscode.window.showInformationMessage(
          'Courier: GitHub token stored securely.'
        );
      }
    })
  );
}

export function deactivate() {}
