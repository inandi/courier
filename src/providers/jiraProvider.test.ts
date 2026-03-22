import { normalizeBaseUrl, buildIssueUrl } from './jiraProvider';

describe('normalizeBaseUrl', () => {
  it('returns the URL unchanged when already well-formed', () => {
    expect(normalizeBaseUrl('https://mycompany.atlassian.net')).toBe(
      'https://mycompany.atlassian.net'
    );
  });

  it('strips a trailing slash', () => {
    expect(normalizeBaseUrl('https://mycompany.atlassian.net/')).toBe(
      'https://mycompany.atlassian.net'
    );
  });

  it('strips multiple trailing slashes', () => {
    expect(normalizeBaseUrl('https://mycompany.atlassian.net///')).toBe(
      'https://mycompany.atlassian.net'
    );
  });

  it('prepends https:// when no protocol is present', () => {
    expect(normalizeBaseUrl('mycompany.atlassian.net')).toBe(
      'https://mycompany.atlassian.net'
    );
  });

  it('does not double-add https:// when already present', () => {
    expect(normalizeBaseUrl('https://mycompany.atlassian.net')).not.toContain(
      'https://https://'
    );
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeBaseUrl('  https://mycompany.atlassian.net  ')).toBe(
      'https://mycompany.atlassian.net'
    );
  });

  it('preserves http:// for non-SSL instances', () => {
    expect(normalizeBaseUrl('http://jira.internal.corp')).toBe(
      'http://jira.internal.corp'
    );
  });
});

describe('buildIssueUrl', () => {
  it('builds a correct browse URL from base URL and issue key', () => {
    expect(buildIssueUrl('https://mycompany.atlassian.net', 'PROJ-42')).toBe(
      'https://mycompany.atlassian.net/browse/PROJ-42'
    );
  });

  it('normalizes base URL before building (strips trailing slash)', () => {
    expect(buildIssueUrl('https://mycompany.atlassian.net/', 'PROJ-1')).toBe(
      'https://mycompany.atlassian.net/browse/PROJ-1'
    );
  });

  it('handles a base URL without protocol', () => {
    expect(buildIssueUrl('mycompany.atlassian.net', 'BUG-7')).toBe(
      'https://mycompany.atlassian.net/browse/BUG-7'
    );
  });

  it('uses the exact issue key provided', () => {
    const url = buildIssueUrl('https://acme.atlassian.net', 'ACME-999');
    expect(url).toContain('ACME-999');
  });
});
