# Release v2.1.1 - 2026-03-17

## Improvements
- Corrected repository link in README.md

---

# Release v1.1.6 - 2026-03-17

## Improvements
- Renamed extension to "Git Exclude - Local" consistently across README, documentation, user-facing messages, and source code
- Enhanced README for clarity and readability
- Refined documentation titles in `doc/PROCESS.md` and `doc/TECHNICAL.md` for consistency
- Added JSDoc code documentation to `src/extension.ts`

---

# Release v1.1.4 - 2026-03-16

## Improvements
- Renamed extension package identifier to `inandi-git-exclude` to resolve a VS Code Marketplace name conflict
- Updated display name to `Git Exclude - Local Ignore` to resolve a VS Code Marketplace display name conflict

---

# Release v1.1.3 - 2026-03-16

## Improvements
- Added extension logo/icon (`media/logo.png`)
- Broadened VS Code engine compatibility to `^1.74.0` and aligned dev dependencies accordingly
- Added author information to `package.json`
- Added MIT License
- Added technical and process documentation (`doc/TECHNICAL.md`, `doc/PROCESS.md`)
- Added publishing and release management infrastructure (`release.sh`, `.publish-secrets.sample`, `.vscodeignore`)
- Enhanced README with full usage instructions, feature descriptions, and tips

---

# Release v1.1.2 - 2026-03-16

## New Features
- Add files and folders to `.git/info/exclude` via a single right-click in the Explorer
- Context menu item "$(diff-ignored) Add to .git/exclude" appears for both files and folders
- Automatic relative path resolution from the workspace root
- Directory detection: trailing `/` appended automatically for folders
- Cross-platform slash normalization: Windows backslashes converted to forward slashes
- Duplicate prevention: skips writing if the path is already present in the exclude file
- Auto-creates `.git/info/exclude` with a standard Git header if the file does not exist yet

## Known Issues
- Command is only available from the Explorer context menu; invoking from the command palette shows an error message

---

