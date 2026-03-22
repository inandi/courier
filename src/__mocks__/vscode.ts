/**
 * Minimal vscode API stub for unit tests.
 * Only the surface area used by the files under test needs to be represented.
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
