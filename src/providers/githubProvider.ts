/**
 * GitHub issue creation: gh CLI first, Octokit fallback
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { Octokit } from 'octokit';

const execAsync = promisify(exec);

export interface GitHubRepo {
  owner: string;
  repo: string;
}

export interface CreateIssueResult {
  url: string;
  number: number;
}

/**
 * Check if gh CLI is installed and authenticated
 */
export async function isGhAuthenticated(): Promise<boolean> {
  try {
    await execAsync('gh auth status', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get repo from gh repo view (current directory context)
 */
export async function getRepoFromGh(cwd: string): Promise<GitHubRepo | null> {
  try {
    const { stdout } = await execAsync('gh repo view --json nameWithOwner', {
      cwd,
      timeout: 5000,
    });
    const data = JSON.parse(stdout.trim()) as { nameWithOwner?: string };
    const full = data?.nameWithOwner;
    if (full && full.includes('/')) {
      const [owner, repo] = full.split('/');
      return { owner, repo };
    }
  } catch {
    // Not a gh repo or not authenticated
  }
  return null;
}

/**
 * Create issue via gh CLI.
 * Uses --body-file for multiline content to avoid shell escaping issues.
 */
export async function createIssueViaGh(
  repo: GitHubRepo,
  title: string,
  body: string,
  cwd: string
): Promise<CreateIssueResult> {
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');

  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `courier-body-${Date.now()}.md`);
  fs.writeFileSync(tmpFile, body || ' ', 'utf-8');

  try {
    const titleArg = `--title "${title.replace(/"/g, '\\"')}"`;
    const bodyArg = `--body-file "${tmpFile}"`;
    const cmd = `gh issue create --repo ${repo.owner}/${repo.repo} ${titleArg} ${bodyArg}`;

    const { stdout } = await execAsync(cmd, { cwd, timeout: 30000 });
    const url = stdout.trim();
    const match = url.match(/#(\d+)/);
    const number = match ? parseInt(match[1], 10) : 0;
    return { url, number };
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get GitHub token from gh auth token or SecretStorage
 */
export async function getGitHubToken(context: vscode.ExtensionContext): Promise<string | null> {
  try {
    const { stdout } = await execAsync('gh auth token', { timeout: 5000 });
    const token = stdout.trim();
    if (token) return token;
  } catch {
    // gh not available or not authenticated
  }

  const stored = await context.secrets.get('courier.github.token');
  return stored ?? null;
}

/**
 * Create issue via Octokit REST API
 */
export async function createIssueViaApi(
  repo: GitHubRepo,
  title: string,
  body: string,
  token: string
): Promise<CreateIssueResult> {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.rest.issues.create({
    owner: repo.owner,
    repo: repo.repo,
    title,
    body: body || undefined,
  });
  return {
    url: data.html_url ?? '',
    number: data.number ?? 0,
  };
}

/**
 * Resolve repo: config override → gh repo view → prompt
 */
export async function resolveRepo(
  workspaceRoot: string,
  context: vscode.ExtensionContext
): Promise<GitHubRepo | null> {
  const config = vscode.workspace.getConfiguration('courier');
  const override = config.get<string>('github.repo');
  if (override && override.includes('/')) {
    const [owner, repo] = override.split('/').map((s) => s.trim());
    if (owner && repo) return { owner, repo };
  }

  const fromGh = await getRepoFromGh(workspaceRoot);
  if (fromGh) return fromGh;

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
