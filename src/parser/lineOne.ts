/**
 * LineOne parser: Line 1 = title, Line 2+ = body
 */

export interface ParsedDraft {
  title: string;
  body: string;
  /** GitHub labels to apply (from frontmatter). */
  labels?: string[];
  /** GitHub usernames to assign (from frontmatter). */
  assignees?: string[];
  /** GitHub milestone number (from frontmatter). */
  milestone?: number;
}

/**
 * Parse .md content using LineOne format.
 * First non-empty line = title; remaining lines = body.
 */
export function parseLineOne(content: string): ParsedDraft | null {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const firstIdx = lines.findIndex((l) => l.length > 0);

  if (firstIdx === -1) {
    return null;
  }

  const title = lines[firstIdx];
  const body = lines.slice(firstIdx + 1).join('\n').trim();

  return { title, body };
}
