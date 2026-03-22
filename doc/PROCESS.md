# Courier — Process Documentation

## 1. Development environment setup

### Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 18.x | 20.x or 22.x recommended |
| npm | 8.x | Bundled with Node |
| VS Code | 1.85.0 | Extension host version |
| TypeScript | 5.3.0 | Installed as dev dependency; use `npx tsc` |

### Clone and install

```bash
git clone <repo-url>
cd courier
npm install
```

### First build

```bash
npm run compile      # compile src/ → out/
```

You should see no errors. The `out/` directory is created with `extension.js` and all supporting modules.

---

## 2. Running the extension locally

### Launch the Extension Development Host

1. Open the project folder in VS Code.
2. Press **F5** (or go to **Run → Start Debugging**).
3. A second VS Code window opens — this is the **Extension Development Host**.
4. In that window, open any folder, create a `.md` file, and run commands from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

The `.vscode/launch.json` defines the debug configuration:

```json
{
  "type": "extensionHost",
  "request": "launch",
  "name": "Run Extension",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
  "outFiles": ["${workspaceFolder}/out/**/*.js"],
  "preLaunchTask": "${defaultBuildTask}"
}
```

The `defaultBuildTask` is `npm run watch` (defined in `.vscode/tasks.json`), which starts the TypeScript incremental compiler in the background before the Extension Host launches.

### Watch mode (recommended during development)

```bash
npm run watch
```

The TypeScript compiler watches for file changes and recompiles incrementally. After a code change, you only need to reload the Extension Development Host window — **Cmd+R** (macOS) or via **Developer: Reload Window** in the Command Palette.

---

## 3. Project conventions

### File naming

- Source files: `camelCase.ts`
- Test files: `camelCase.test.ts` — co-located next to the file under test
- Documentation: `UPPER_CASE.md` in `_doc/`

### TypeScript conventions

- `strict: true` is enforced — no `any` types without explicit cast.
- All async functions return explicit `Promise<T>` types.
- `null` is used to signal "nothing resolved / user cancelled" (not `undefined`) at function boundaries.
- Internal helpers (not called from other modules) are not exported.
- Exported interfaces are defined in the same file as the function that produces them.

### Error handling

- Errors from external APIs (GitHub, Jira) are caught per-file inside `shipFiles` loops. A failed file never aborts the rest of the batch.
- If a critical pre-condition fails (no credentials, user cancelled, no workspace), the function shows a VS Code warning/error message and returns early with an empty result array.
- `err instanceof Error ? err.message : String(err)` is used everywhere an unknown error must be shown to the user.

### VS Code UI conventions

- Use `showInformationMessage` for success.
- Use `showWarningMessage` for user-cancellable situations (no credentials, no selection).
- Use `showErrorMessage` for unrecoverable failures (invalid credentials, API errors).
- Every command that does I/O work shows the status bar spinner via `createShipStatusBar()`. The spinner is always disposed in a `finally` block so it never gets stuck.
- All `showQuickPick` calls with multiple items use `canPickMany: true` and start with all items `picked: true` — the user opts out of files, rather than opting in.

### Comment policy

- Block `/** */` JSDoc comments on all exported functions and interfaces.
- Inline `//` comments only for non-obvious logic.
- No comments that restate what the code already says.
- Section separators `// -----` are used inside long files to break logical blocks.

---

## 4. Adding a new command

### Step 1 — Write the command function

Create or update a file in `src/commands/`. Follow the existing pattern:

```typescript
// src/commands/shipToNewTarget.ts
export async function shipFolderToNewTarget(context: vscode.ExtensionContext) {
  // 1. Guard: workspace open?
  // 2. Find files (findMdFiles)
  // 3. Confirm files (confirmFiles from utils/uiUtils)
  // 4. Authenticate / resolve target
  // 5. shipFilesToNewTarget(confirmed, workspaceRoot, context)
  // 6. showSummary(results)
}
```

The shared helpers `confirmFiles()` and `createShipStatusBar()` from `src/utils/uiUtils.ts` must be used for consistency.

### Step 2 — Register in `extension.ts`

```typescript
import { shipFolderToNewTarget } from './commands/shipToNewTarget';

context.subscriptions.push(
  vscode.commands.registerCommand(
    'courier.shipFolderToNewTarget',
    () => shipFolderToNewTarget(context)
  )
);
```

### Step 3 — Declare in `package.json`

Add the command to `contributes.commands`:

```json
{
  "command": "courier.shipFolderToNewTarget",
  "title": "Courier: Ship Folder to New Target"
}
```

Add to `activationEvents`:

```json
"onCommand:courier.shipFolderToNewTarget"
```

Add any new settings to `contributes.configuration.properties`.

### Step 4 — Add to context menu (if applicable)

```json
{
  "command": "courier.shipFileToNewTargetFromExplorer",
  "when": "explorerResourceIsFolder == false && resourceExtname == .md",
  "group": "courier@3"
}
```

The `group` value controls sort order within the Courier section.

---

## 5. Adding a new provider

A "provider" encapsulates all communication with one external service (auth, API calls, type definitions).

### Checklist

1. **Create `src/providers/<name>Provider.ts`.**
   - Define credential interfaces and storage keys.
   - Implement a `getCredentials(context)` function reading from settings + SecretStorage.
   - Implement a `saveCredentials(context, creds)` function.
   - Implement a `validateCredentials(creds)` function that makes a cheap test API call.
   - Implement `createIssue(creds, payload)` returning a `CreateResult` with at minimum `{ url: string }`.

2. **Extend `ParsedDraft` in `src/parser/lineOne.ts`** if the provider needs fields not already in the interface. Add the corresponding key handling in `src/parser/frontmatter.ts` and the merge step in `src/parser/templateParser.ts`.

3. **Write a test file `src/providers/<name>Provider.test.ts`** covering all pure functions (URL building, normalization, auth header construction, etc.) using the vscode mock.

4. **Create a command file `src/commands/shipTo<Name>.ts`** following the pattern in `shipToGitHub.ts` and `shipToJira.ts`.

5. **Register commands** in `extension.ts` and `package.json`.

---

## 6. Adding frontmatter fields

1. Add the field to `FrontmatterData` in `src/parser/frontmatter.ts`.
2. Add a `case` for the field key in `parseFrontmatterBlock()`.
3. Add the field to `ParsedDraft` in `src/parser/lineOne.ts`.
4. Add a merge step in `parseWithTemplate()` in `src/parser/templateParser.ts`.
5. Add test cases to `src/parser/frontmatter.test.ts`.
6. Use the field in the relevant provider/command.

---

## 7. Testing

### Running tests

```bash
npm test                        # run all tests
npx jest --watch                # watch mode, re-run on save
npx jest src/parser             # run only parser tests
npx jest --testNamePattern body # run tests whose name contains "body"
npx jest --no-coverage          # skip coverage (faster)
```

### Writing a new test file

1. Create `<module>.test.ts` next to the module under test.
2. Import only the pure functions you want to test — avoid importing anything that needs a live VS Code environment.
3. If the module imports `vscode`, the mock at `src/__mocks__/vscode.ts` is applied automatically via `moduleNameMapper` in `jest.config.js`.
4. If you need to mock a module, use `jest.mock()` at the top of the test file.

### What to test

- All pure functions with no side effects (parsers, URL builders, normalizers).
- Edge cases documented in the spec: empty input, CRLF line endings, missing frontmatter, partial fields.
- Do **not** write tests for VS Code UI interactions (QuickPick, InputBox) or file system operations — these are integration concerns best covered by manual testing in the Extension Development Host.

### VS Code mock (`src/__mocks__/vscode.ts`)

The mock provides the minimum surface area needed by the tested modules:

```typescript
const vscode = {
  workspace: { getConfiguration: () => ({ get: () => undefined }) },
  window: { showInputBox: jest.fn(), showInformationMessage: jest.fn(), showErrorMessage: jest.fn() },
  authentication: { getSession: jest.fn() },
  Uri: { file: (p) => ({ fsPath: p }) },
  ProgressLocation: { Notification: 15 },
};
```

Extend this file if a new module under test uses additional VS Code APIs.

---

## 8. Debugging

### Extension not activating

- Check the Command Palette for `Courier:` entries — if absent, the extension did not load.
- Open **Output → Extension Host** for activation errors.
- Ensure `npm run compile` (or `watch`) completed without errors before pressing F5.

### TypeScript errors after editing

```bash
npx tsc --noEmit    # type-check without emitting files
```

This is the fastest way to check for type errors across the whole project without a full recompile.

### Breakpoints in the Extension Development Host

Breakpoints set in `src/` files work in the debugger when F5 is used. Source maps are generated by default (`tsconfig.json` does not disable them). You can step through the TypeScript source directly.

### Logging

Use `console.log()` during development. Output appears in the **Output → Extension Host** panel of the *host* VS Code window (the one you pressed F5 from), not in the Extension Development Host.

To leave persistent logging for development, use:
```typescript
const channel = vscode.window.createOutputChannel('Courier');
channel.appendLine('Debug info here');
channel.show();
```

Remove or guard with a debug flag before committing.

### Jira API errors

Jira's REST API returns errors in two shapes:
- `{ "errorMessages": ["Project 'XYZ' does not exist."] }`
- `{ "errors": { "summary": "Field required" } }`

The `jiraRequest` helper in `jiraProvider.ts` extracts both and joins them into the thrown `Error.message`. Errors are displayed verbatim in the VS Code error notification.

Common Jira errors and causes:

| HTTP status | Common cause |
|---|---|
| 401 | Wrong email or API token |
| 403 | Token does not have create-issue permission on the project |
| 404 | Project key does not exist or is not accessible |
| 400 | Required field missing (e.g. issue type not valid for project) |

### GitHub API errors

Octokit throws an `RequestError` with `.status` and `.message`. Common errors:

| HTTP status | Common cause |
|---|---|
| 401 | Token expired or revoked |
| 403 | Token lacks `repo` scope |
| 404 | Repo does not exist or is not accessible with the token |
| 422 | Validation failed (e.g. label does not exist in repo) |

---

## 9. Release process

### Version bump

1. Update `"version"` in `package.json`.
2. Add an entry to `CHANGELOG.md` describing changes.
3. Append a one-line entry to `version.md`:
   ```
   v0.3.0 => <Author> on <date>
   ```

### Build and package

```bash
npm run compile                 # ensure clean build
npm install -g @vscode/vsce     # if not already installed
vsce package                    # produces courier-<version>.vsix
```

The `.vscodeignore` file controls what is excluded from the package. Ensure `_doc/`, `src/`, `*.test.ts`, and development tooling are excluded.

### Testing the packaged extension

```bash
code --install-extension courier-<version>.vsix
```

Restart VS Code. Test all 8 commands manually in a real workspace with:
- A real GitHub repo (test issue creation, archive, summary).
- A real Jira Cloud instance (test credential setup, project picker, ticket creation, archive).
- Edge cases: empty `.md` file, file already in archive, cancelled QuickPick.

### Publishing to the VS Code Marketplace

```bash
vsce publish
```

Requires a Personal Access Token from `dev.azure.com` with Marketplace publish permission. Store this token securely outside the repository.

---

## 10. Repository hygiene

### What goes in git

- `src/` — all TypeScript source
- `_doc/` — technical and process documentation
- `package.json`, `package-lock.json`, `tsconfig.json`, `jest.config.js`
- `README.md`, `CHANGELOG.md`, `version.md`, `release.md`
- `.vscode/launch.json`, `.vscode/tasks.json`

### What does not go in git (`.gitignore`)

- `node_modules/` — restored by `npm install`
- `out/` — generated by `tsc`
- `dist/` — generated by `vsce package` pre-bundle (if added)
- `*.vsix` — built packages
- `.env*` — any environment files with secrets
- `.DS_Store`, `*.tsbuildinfo` — OS and compiler artefacts

### Commit message conventions

Use a short imperative subject line (50 characters or fewer):

```
fix: preserve blank lines in parseLineOne body
feat: add Jira issue type resolution via QuickPick
refactor: extract confirmFiles to shared uiUtils
test: add CRLF edge cases to frontmatter parser
docs: update TECHNICAL.md archive section
```

Prefix with one of: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.

---

## 11. Manual test checklist

Run before every release.

### GitHub

- [ ] "Courier: Sign in to GitHub" — OAuth flow completes, confirmation message shown
- [ ] "Courier: Sign in to GitHub" — PAT flow: prompt shown, token stored, confirmation shown
- [ ] "Courier: Ship Folder to GitHub" — QuickPick shows all `.md` files pre-ticked
- [ ] Deselecting a file in QuickPick and confirming — deselected file is not shipped
- [ ] Pressing Escape on QuickPick — nothing happens, no error
- [ ] Single file with no frontmatter — issue created with title and body
- [ ] File with `labels:` frontmatter — labels appear on the GitHub issue
- [ ] File with `assignees:` frontmatter — issue assigned correctly
- [ ] Successfully shipped file — moved to `_courier_processed/<timestamp>/`
- [ ] Meta sidecar `.meta.json` — written with correct `source` and `issueUrl`
- [ ] Running the command again on the same folder — archived files are skipped with "Already shipped" message
- [ ] Empty `.md` file — skipped with "Empty or invalid file" message
- [ ] "Open on GitHub" button in summary — opens correct URL in browser
- [ ] `courier.github.repo` override setting — uses the override instead of `.git/config`
- [ ] In a folder with no `.git/config` remote — prompted for `owner/repo` manually

### Jira

- [ ] "Courier: Configure Jira" — three-step input flow (URL, email, token)
- [ ] Invalid credentials — error message shown, credentials not saved
- [ ] Valid credentials — saved, confirmation shown
- [ ] "Courier: Ship Folder to Jira" — QuickPick shows files, project picker appears when no default
- [ ] `courier.jira.defaultProject` set — no project prompt shown
- [ ] `courier.jira.defaultIssueType` set — no issue type prompt shown
- [ ] File with `project:` frontmatter — uses frontmatter project, overrides session default
- [ ] File with `issuetype:` frontmatter — uses frontmatter type
- [ ] File with `priority: High` frontmatter — issue created with High priority
- [ ] File with `labels:` frontmatter — labels applied to Jira ticket
- [ ] File with `assignee:` frontmatter — assignee set on ticket
- [ ] Ticket created — appears in Jira at `<baseUrl>/browse/<KEY>`
- [ ] File archived after success
- [ ] "Open in Browser" button — opens Jira issue URL
- [ ] No credentials configured — "Configure Now" prompt appears inline
- [ ] Explorer right-click "Courier: Ship to Jira" — single file confirmation and ship
