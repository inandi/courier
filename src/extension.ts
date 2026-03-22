/**
 * Courier - Ship GitHub issues and Jira tickets from .md files
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

export function activate(context: vscode.ExtensionContext) {
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

export function deactivate() {}
