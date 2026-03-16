/**
 * LineOne parser: Line 1 = title, Line 2+ = body
 */

export interface ParsedDraft {
  title: string;
  body: string;
}

/**
 * Parse .md content using LineOne format.
 * First non-empty line = title; remaining lines = body.
 */
export function parseLineOne(content: string): ParsedDraft | null {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.filter((l) => l.length > 0);

  if (nonEmpty.length === 0) {
    return null;
  }

  const title = nonEmpty[0];
  const body = nonEmpty.slice(1).join('\n');

  return { title, body };
}
