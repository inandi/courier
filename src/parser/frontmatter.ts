/**
 * Minimal frontmatter parser for Courier .md files.
 *
 * Supported format at the top of the file:
 *
 *   ---
 *   labels: bug, enhancement
 *   assignees: alice, bob
 *   milestone: 3
 *   ---
 *
 *   Issue title here
 *   Body...
 *
 * All fields are optional. Labels and assignees are comma-separated strings.
 * Milestone is a GitHub milestone number (integer).
 */

export interface FrontmatterData {
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

export interface FrontmatterResult {
  data: FrontmatterData;
  /** Content after stripping the frontmatter block (passed to the body parser). */
  content: string;
}

/**
 * Parse optional YAML-lite frontmatter from the top of an .md file.
 * Returns the extracted metadata and the remaining content.
 * If no frontmatter is present the original content is returned unchanged.
 */
export function parseFrontmatter(raw: string): FrontmatterResult {
  const normalized = raw.replace(/\r\n/g, '\n');

  // Must start with --- (optionally preceded by whitespace/blank lines)
  const fmMatch = normalized.match(/^\s*---\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { data: {}, content: normalized };
  }

  const fmBlock = fmMatch[1];
  const rest = fmMatch[2] ?? '';

  const data = parseFrontmatterBlock(fmBlock);
  return { data, content: rest };
}

function parseFrontmatterBlock(block: string): FrontmatterData {
  const data: FrontmatterData = {};

  for (const line of block.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (!value) continue;

    switch (key) {
      case 'labels':
      case 'label': {
        const items = splitCsv(value);
        if (items.length) data.labels = items;
        break;
      }
      case 'assignees':
      case 'assignee': {
        const items = splitCsv(value);
        if (items.length) data.assignees = items;
        break;
      }
      case 'milestone': {
        const n = parseInt(value, 10);
        if (!isNaN(n)) data.milestone = n;
        break;
      }
      default:
        break;
    }
  }

  return data;
}

/** Split a comma-separated value string, trimming each entry. */
function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
