/**
 * GitHub issue creation via Octokit.
 * Auth: VS Code built-in GitHub OAuth session → stored PAT fallback.
 * Repo detection: parses .git/config remote origin URL — no external tools required.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Octokit } from 'octokit';

export interface GitHubRepo {
  owner: string;
  repo: string;
}

export interface CreateIssueResult {
  url: string;
  number: number;
}

export interface IssueMetadata {
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Obtain a GitHub access token.
 * Priority: VS Code GitHub OAuth session → SecretStorage PAT.
 * Returns null if neither is available.
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
 * Prompt the user to sign in via VS Code GitHub OAuth.
 * Used by the explicit "Configure GitHub Token" command path when the user
 * prefers a PAT over OAuth.
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
// Repo detection
// ---------------------------------------------------------------------------

/**
 * Parse .git/config to find the remote "origin" URL and extract owner/repo.
 * Handles both HTTPS and SSH GitHub remote formats.
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
 * Parse a GitHub remote URL (HTTPS or SSH) into { owner, repo }.
 * HTTPS: https://github.com/owner/repo[.git]
 * SSH:   git@github.com:owner/repo[.git]
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
 * Create a GitHub issue via the REST API using Octokit.
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
// Repo resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the target repo.
 * Priority: courier.github.repo setting → .git/config remote origin → user prompt.
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
