/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // vscode is a VS Code host API — provide a minimal stub for unit tests.
    '^vscode$': '<rootDir>/src/__mocks__/vscode.ts',
  },
};
