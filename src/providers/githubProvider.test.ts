import { parseGitHubRemoteUrl } from './githubProvider';

describe('parseGitHubRemoteUrl', () => {
  // -------------------------------------------------------------------------
  // HTTPS remotes
  // -------------------------------------------------------------------------
  it('parses a standard HTTPS remote with .git suffix', () => {
    expect(parseGitHubRemoteUrl('https://github.com/owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('parses a HTTPS remote without .git suffix', () => {
    expect(parseGitHubRemoteUrl('https://github.com/owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('parses a HTTPS remote with a token embedded (git credential helper format)', () => {
    expect(
      parseGitHubRemoteUrl('https://x-access-token:ghp_abc@github.com/owner/repo.git')
    ).toEqual({ owner: 'owner', repo: 'repo' });
  });

  // -------------------------------------------------------------------------
  // SSH remotes
  // -------------------------------------------------------------------------
  it('parses a standard SSH remote with .git suffix', () => {
    expect(parseGitHubRemoteUrl('git@github.com:owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('parses an SSH remote without .git suffix', () => {
    expect(parseGitHubRemoteUrl('git@github.com:owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  // -------------------------------------------------------------------------
  // Non-GitHub remotes
  // -------------------------------------------------------------------------
  it('returns null for a non-GitHub HTTPS remote', () => {
    expect(parseGitHubRemoteUrl('https://gitlab.com/owner/repo.git')).toBeNull();
  });

  it('returns null for a non-GitHub SSH remote', () => {
    expect(parseGitHubRemoteUrl('git@gitlab.com:owner/repo.git')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseGitHubRemoteUrl('')).toBeNull();
  });

  it('returns null for an arbitrary string', () => {
    expect(parseGitHubRemoteUrl('not-a-url')).toBeNull();
  });
});
