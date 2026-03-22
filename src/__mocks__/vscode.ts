/**
 * Courier VS Code API Mock
 *
 * Minimal stub of the VS Code host API used exclusively by Jest unit tests.
 * Only the surface area that is actually imported and exercised by the modules
 * under test needs to be represented here — anything else can be added on demand.
 * This file is mapped to the `vscode` module via jest.config.js moduleNameMapper
 * so that tests can run outside the VS Code Extension Host.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

const vscode = {
  workspace: {
    getConfiguration: () => ({
      get: () => undefined,
    }),
  },
  window: {
    showInputBox: jest.fn(),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
  },
  authentication: {
    getSession: jest.fn(),
  },
  Uri: {
    file: (p: string) => ({ fsPath: p }),
  },
  ProgressLocation: {
    Notification: 15,
  },
};

module.exports = vscode;
