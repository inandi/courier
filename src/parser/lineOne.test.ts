import { parseLineOne } from './lineOne';

describe('parseLineOne', () => {
  // -------------------------------------------------------------------------
  // Empty / whitespace-only input
  // -------------------------------------------------------------------------
  it('returns null for an empty string', () => {
    expect(parseLineOne('')).toBeNull();
  });

  it('returns null for a string containing only whitespace', () => {
    expect(parseLineOne('   \n   \n   ')).toBeNull();
  });

  it('returns null for a string containing only blank lines', () => {
    expect(parseLineOne('\n\n\n')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Single line
  // -------------------------------------------------------------------------
  it('returns title with empty body for a single non-empty line', () => {
    expect(parseLineOne('Hello world')).toEqual({ title: 'Hello world', body: '' });
  });

  it('returns title with empty body when file has one line followed by blank lines', () => {
    expect(parseLineOne('Title\n\n\n')).toEqual({ title: 'Title', body: '' });
  });

  // -------------------------------------------------------------------------
  // Two lines
  // -------------------------------------------------------------------------
  it('returns correct title and body for two lines', () => {
    expect(parseLineOne('Title\nBody line')).toEqual({
      title: 'Title',
      body: 'Body line',
    });
  });

  // -------------------------------------------------------------------------
  // Leading blank lines before title
  // -------------------------------------------------------------------------
  it('skips leading blank lines and uses first non-empty line as title', () => {
    expect(parseLineOne('\n\nActual Title\nBody text')).toEqual({
      title: 'Actual Title',
      body: 'Body text',
    });
  });

  // -------------------------------------------------------------------------
  // Blank lines preserved in body
  // -------------------------------------------------------------------------
  it('preserves blank lines between body paragraphs', () => {
    const input = 'Title\n\nParagraph one\n\nParagraph two';
    const result = parseLineOne(input);
    expect(result?.title).toBe('Title');
    expect(result?.body).toContain('Paragraph one');
    expect(result?.body).toContain('Paragraph two');
    // Blank line between paragraphs must be present
    expect(result?.body).toMatch(/Paragraph one\s*\n\s*\nParagraph two/);
  });

  // -------------------------------------------------------------------------
  // CRLF line endings
  // -------------------------------------------------------------------------
  it('handles CRLF line endings', () => {
    expect(parseLineOne('Title\r\nBody line')).toEqual({
      title: 'Title',
      body: 'Body line',
    });
  });

  it('handles CRLF with leading blank lines', () => {
    expect(parseLineOne('\r\n\r\nTitle\r\nBody')).toEqual({
      title: 'Title',
      body: 'Body',
    });
  });

  // -------------------------------------------------------------------------
  // Whitespace trimming on title
  // -------------------------------------------------------------------------
  it('trims whitespace from the title line', () => {
    expect(parseLineOne('  My Title  \nBody')).toEqual({
      title: 'My Title',
      body: 'Body',
    });
  });

  // -------------------------------------------------------------------------
  // Multi-paragraph body
  // -------------------------------------------------------------------------
  it('returns all lines after the title as body', () => {
    const input = 'Title\nLine 1\nLine 2\nLine 3';
    expect(parseLineOne(input)).toEqual({
      title: 'Title',
      body: 'Line 1\nLine 2\nLine 3',
    });
  });
});
