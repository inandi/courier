import { parseFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  // -------------------------------------------------------------------------
  // No frontmatter
  // -------------------------------------------------------------------------
  it('returns empty data and original content when no frontmatter present', () => {
    const input = 'Issue title\nBody here';
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({});
    expect(result.content).toBe('Issue title\nBody here');
  });

  it('returns empty data when content is just a title with no --- block', () => {
    const result = parseFrontmatter('Just a title');
    expect(result.data).toEqual({});
    expect(result.content).toBe('Just a title');
  });

  // -------------------------------------------------------------------------
  // Labels
  // -------------------------------------------------------------------------
  it('parses a single label', () => {
    const input = '---\nlabels: bug\n---\nTitle';
    const { data } = parseFrontmatter(input);
    expect(data.labels).toEqual(['bug']);
  });

  it('parses multiple comma-separated labels', () => {
    const input = '---\nlabels: bug, enhancement, help wanted\n---\nTitle';
    const { data } = parseFrontmatter(input);
    expect(data.labels).toEqual(['bug', 'enhancement', 'help wanted']);
  });

  it('accepts "label" (singular) as an alias for labels', () => {
    const input = '---\nlabel: bug\n---\nTitle';
    const { data } = parseFrontmatter(input);
    expect(data.labels).toEqual(['bug']);
  });

  // -------------------------------------------------------------------------
  // Assignees
  // -------------------------------------------------------------------------
  it('parses a single assignee', () => {
    const input = '---\nassignees: alice\n---\nTitle';
    const { data } = parseFrontmatter(input);
    expect(data.assignees).toEqual(['alice']);
  });

  it('parses multiple comma-separated assignees', () => {
    const input = '---\nassignees: alice, bob\n---\nTitle';
    const { data } = parseFrontmatter(input);
    expect(data.assignees).toEqual(['alice', 'bob']);
  });

  it('accepts "assignee" (singular) as alias', () => {
    const input = '---\nassignee: charlie\n---\nTitle';
    const { data } = parseFrontmatter(input);
    expect(data.assignees).toEqual(['charlie']);
  });

  // -------------------------------------------------------------------------
  // Milestone
  // -------------------------------------------------------------------------
  it('parses a numeric milestone', () => {
    const input = '---\nmilestone: 3\n---\nTitle';
    const { data } = parseFrontmatter(input);
    expect(data.milestone).toBe(3);
  });

  it('ignores a non-numeric milestone value', () => {
    const input = '---\nmilestone: Sprint 1\n---\nTitle';
    const { data } = parseFrontmatter(input);
    expect(data.milestone).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Combined fields
  // -------------------------------------------------------------------------
  it('parses labels, assignees, and milestone together', () => {
    const input = [
      '---',
      'labels: bug, enhancement',
      'assignees: alice',
      'milestone: 2',
      '---',
      '',
      'Issue Title',
      'Body of the issue.',
    ].join('\n');

    const { data, content } = parseFrontmatter(input);
    expect(data.labels).toEqual(['bug', 'enhancement']);
    expect(data.assignees).toEqual(['alice']);
    expect(data.milestone).toBe(2);
    expect(content).toContain('Issue Title');
    expect(content).toContain('Body of the issue.');
  });

  // -------------------------------------------------------------------------
  // Content extraction
  // -------------------------------------------------------------------------
  it('strips the frontmatter block and returns only the body content', () => {
    const input = '---\nlabels: bug\n---\nTitle\nBody';
    const { content } = parseFrontmatter(input);
    expect(content).not.toContain('---');
    expect(content).not.toContain('labels');
    expect(content).toContain('Title');
  });

  // -------------------------------------------------------------------------
  // CRLF
  // -------------------------------------------------------------------------
  it('handles CRLF line endings in the frontmatter block', () => {
    const input = '---\r\nlabels: bug\r\n---\r\nTitle\r\nBody';
    const { data, content } = parseFrontmatter(input);
    expect(data.labels).toEqual(['bug']);
    expect(content).toContain('Title');
  });

  // -------------------------------------------------------------------------
  // Unknown keys are silently ignored
  // -------------------------------------------------------------------------
  it('silently ignores unknown frontmatter keys', () => {
    const input = '---\nunknown: value\nlabels: bug\n---\nTitle';
    const { data } = parseFrontmatter(input);
    expect(data.labels).toEqual(['bug']);
    expect((data as Record<string, unknown>).unknown).toBeUndefined();
  });
});
