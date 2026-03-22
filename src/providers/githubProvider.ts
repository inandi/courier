/**
 * Courier GitHub Provider
 *
 * Handles all GitHub interactions: token acquisition, repository detection,
 * and issue creation via the Octokit REST client. Authentication uses VS Code's
 * built-in GitHub OAuth session as the primary source, falling back to a
 * manually entered PAT stored in SecretStorage. Repository detection reads
 * `.git/config` directly — no external CLI tools are required.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Octokit } from 'octokit';

/**
 * Identifies a GitHub repository by owner and repository name.
 *
 * @version 1.1.1
 */
export interface GitHubRepo {
  /** Repository owner — GitHub username or organisation name. */
  owner: string;
  /** Repository name (the part after the `/` in `owner/repo`). */
  repo: string;
}

/**
 * Describes the result of a successful GitHub issue creation API call.
 *
 * @version 1.1.1
 */
export interface CreateIssueResult {
  /** Full browser URL of the newly created issue. */
  url: string;
  /** GitHub sequential issue number assigned by the API. */
  number: number;
}

/**
 * Optional metadata that can be attached to a GitHub issue on creation.
 * All fields are derived from the file's YAML-lite frontmatter.
 *
 * @version 1.1.1
 */
export interface IssueMetadata {
  /** Label names to apply to the issue. */
  labels?: string[];
  /** GitHub usernames to assign the issue to. */
  assignees?: string[];
  /** Numeric ID of the milestone to associate with the issue. */
  milestone?: number;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Obtains a GitHub access token using a two-step priority chain.
 * First tries VS Code's built-in GitHub OAuth provider (no token to manage);
 * if that is unavailable or returns nothing, falls back to a PAT previously
 * stored in VS Code SecretStorage. Returns null when neither source yields a token.
 *
 * @param {vscode.ExtensionContext} context - The VS Code extension context
 * @returns {Promise<string | null>} A valid access token, or null if unavailable
 * @version 1.1.1
 */
export async function getGitHubToken(
  context: vscode.ExtensionContext
): Promise<string | null> {
  // 1. Try VS Code's built-in GitHub authentication provider (OAuth, no CLI needed).
  try {
    const session = await vscode.authentication.getSession(
      'github',
      ['repo'],
      { createIfNone: false }
    );
    if (session?.accessToken) {
      return session.accessToken;
    }
  } catch {
    // Auth provider unavailable in this environment — fall through.
  }

  // 2. Fall back to a manually stored PAT.
  const stored = await context.secrets.get('courier.github.token');
  return stored ?? null;
}

/**
 * Prompts the user to authenticate with GitHub.
 * Attempts VS Code OAuth first (preferred — no token to copy/paste). If OAuth
 * is unavailable or declined, falls back to an input box for a Personal Access
 * Token (PAT), which is then persisted in SecretStorage for future sessions.
 *
 * @param {vscode.ExtensionContext} context - The VS Code extension context
 * @returns {Promise<string | null>} The authenticated token, or null if the user cancelled
 * @version 1.1.1
 */
export async function promptForGitHubToken(
  context: vscode.ExtensionContext
): Promise<string | null> {
  // Attempt OAuth first (preferred: no token to copy/paste).
  try {
    const session = await vscode.authentication.getSession(
      'github',
      ['repo'],
      { createIfNone: true }
    );
    if (session?.accessToken) {
      return session.accessToken;
    }
  } catch {
    // Fall through to PAT prompt.
  }

  // Manual PAT fallback.
  const token = await vscode.window.showInputBox({
    prompt: 'Enter your GitHub Personal Access Token (needs "repo" scope)',
    password: true,
    placeHolder: 'ghp_xxxxxxxxxxxx',
    validateInput: (v) => (v.trim().length > 0 ? null : 'Token is required'),
  });
  if (token) {
    await context.secrets.store('courier.github.token', token.trim());
    return token.trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Repository detection
// ---------------------------------------------------------------------------

/**
 * Reads `.git/config` in the given workspace root and extracts the remote
 * `origin` URL, then delegates to parseGitHubRemoteUrl to produce an owner/repo
 * pair. Returns null when no `.git/config` exists, the file cannot be read, or
 * there is no `origin` remote configured.
 *
 * @param {string} workspaceRoot - Absolute path to the workspace root folder
 * @returns {GitHubRepo | null} Parsed owner and repo, or null if detection fails
 * @version 1.1.1
 */
export function getRepoFromGitConfig(workspaceRoot: string): GitHubRepo | null {
  const gitConfigPath = path.join(workspaceRoot, '.git', 'config');
  if (!fs.existsSync(gitConfigPath)) {
    return null;
  }

  let raw: string;
  try {
    raw = fs.readFileSync(gitConfigPath, 'utf-8');
  } catch {
    return null;
  }

  // Find [remote "origin"] section and extract url = ...
  const remoteOriginMatch = raw.match(
    /\[remote\s+"origin"\][^\[]*url\s*=\s*([^\r\n]+)/
  );
  if (!remoteOriginMatch) {
    return null;
  }

  const remoteUrl = remoteOriginMatch[1].trim();
  return parseGitHubRemoteUrl(remoteUrl);
}

/**
 * Parses a GitHub remote URL in either HTTPS or SSH format into an owner/repo
 * pair. An optional `.git` suffix is stripped from the repository name.
 *
 * Supported formats:
 * - HTTPS: `https://github.com/owner/repo[.git]`
 * - SSH:   `git@github.com:owner/repo[.git]`
 *
 * @param {string} url - Raw remote URL string from `.git/config`
 * @returns {GitHubRepo | null} Parsed owner and repo, or null if the URL is not a recognised GitHub format
 * @version 1.1.1
 */
export function parseGitHubRemoteUrl(url: string): GitHubRepo | null {
  // HTTPS
  const httpsMatch = url.match(/https?:\/\/(?:[^@]+@)?github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // SSH
  const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Issue creation
// ---------------------------------------------------------------------------

/**
 * Creates a GitHub issue via the REST API using the Octokit client.
 * The issue title, body, labels, assignees, and milestone are all passed
 * through to the API. Returns the browser URL and issue number on success;
 * throws an Octokit RequestError on API failure.
 *
 * @param {GitHubRepo} repo - Target repository owner and name
 * @param {string} title - Issue title
 * @param {string} body - Issue body text (may be empty)
 * @param {string} token - GitHub access token with `repo` scope
 * @param {IssueMetadata} meta - Optional metadata (labels, assignees, milestone)
 * @returns {Promise<CreateIssueResult>} The created issue's URL and number
 * @version 1.1.1
 */
export async function createIssueViaApi(
  repo: GitHubRepo,
  title: string,
  body: string,
  token: string,
  meta: IssueMetadata = {}
): Promise<CreateIssueResult> {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.rest.issues.create({
    owner: repo.owner,
    repo: repo.repo,
    title,
    body: body || undefined,
    labels: meta.labels,
    assignees: meta.assignees,
    milestone: meta.milestone,
  });
  return {
    url: data.html_url ?? '',
    number: data.number ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Repository resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the target GitHub repository for the current workspace.
 * Resolution priority: `courier.github.repo` setting → `.git/config` remote
 * origin → interactive user prompt. Returns null when the user cancels the
 * prompt or the input is invalid.
 *
 * @param {string} workspaceRoot - Absolute path to the workspace root folder
 * @param {vscode.ExtensionContext} context - The VS Code extension context
 * @returns {Promise<GitHubRepo | null>} Resolved repository, or null if unavailable
 * @version 1.1.1
 */
export async function resolveRepo(
  workspaceRoot: string,
  context: vscode.ExtensionContext
): Promise<GitHubRepo | null> {
  // 1. Explicit config override.
  const config = vscode.workspace.getConfiguration('courier');
  const override = config.get<string>('github.repo');
  if (override && override.includes('/')) {
    const [owner, repo] = override.split('/').map((s) => s.trim());
    if (owner && repo) return { owner, repo };
  }

  // 2. Detect from .git/config.
  const fromGit = getRepoFromGitConfig(workspaceRoot);
  if (fromGit) return fromGit;

  // 3. Ask the user.
  const input = await vscode.window.showInputBox({
    prompt: 'Enter GitHub repo (owner/repo)',
    placeHolder: 'owner/repo',
    validateInput: (v) =>
      /^[\w-]+\/[\w.-]+$/.test(v.trim()) ? null : 'Format: owner/repo',
  });
  if (!input) return null;
  const [owner, repo] = input.trim().split('/');
  return { owner, repo };
}
