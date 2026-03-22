/**
 * Courier Frontmatter Parser
 *
 * Parses optional YAML-lite frontmatter blocks at the top of Courier .md
 * draft files. The frontmatter block is delimited by `---` fences and
 * supports both GitHub fields (labels, assignees, milestone) and Jira
 * fields (project, issuetype, priority). All fields are optional and the
 * parser is intentionally lenient — unknown keys are silently ignored.
 *
 * Supported format:
 *
 *   ---
 *   labels: bug, enhancement
 *   assignees: alice, bob        (GitHub usernames, comma-separated)
 *   assignee: dev@company.com   (singular alias also accepted)
 *   milestone: 3                 (GitHub milestone number)
 *   project: PROJ                (Jira project key)
 *   issuetype: Story             (Jira issue type)
 *   priority: High               (Jira priority)
 *   ---
 *
 *   Issue title here
 *   Body text...
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

/**
 * Structured metadata extracted from a frontmatter block.
 * Fields map directly to target platform concepts: GitHub labels/assignees/
 * milestone and Jira project/issuetype/priority.
 *
 * @version 1.1.1
 */
export interface FrontmatterData {
  // ------------------------------------------------------------------
  // Shared / GitHub fields
  // ------------------------------------------------------------------
  /** Comma-separated label names for GitHub issues. */
  labels?: string[];
  /** GitHub usernames (or Jira email addresses) to assign to the issue. */
  assignees?: string[];
  /** GitHub milestone ID to attach to the issue. */
  milestone?: number;
  // ------------------------------------------------------------------
  // Jira-specific fields
  // ------------------------------------------------------------------
  /** Jira project key, e.g. `"PROJ"`. */
  project?: string;
  /** Jira issue type name, e.g. `"Story"` or `"Bug"`. */
  issuetype?: string;
  /** Jira priority name, e.g. `"High"` or `"Medium"`. */
  priority?: string;
}

/**
 * Result returned by parseFrontmatter.
 * Contains the extracted metadata and the remaining file content after the
 * frontmatter block has been stripped, ready for the body parser.
 *
 * @version 1.1.1
 */
export interface FrontmatterResult {
  /** Metadata extracted from the frontmatter block (empty object when absent). */
  data: FrontmatterData;
  /** Content after stripping the frontmatter block, passed on to the body parser. */
  content: string;
}

/**
 * Parses optional YAML-lite frontmatter from the top of a raw .md file string.
 * If a valid `---` … `---` block is present at the start of the content the
 * fields inside are extracted into FrontmatterData. The remaining content
 * (everything after the closing `---`) is returned unchanged for downstream
 * parsing. When no frontmatter is found the original content is returned as-is
 * with an empty data object.
 *
 * @param {string} raw - Raw text content of the Markdown file
 * @returns {FrontmatterResult} Extracted metadata and remaining body content
 * @version 1.1.1
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

/**
 * Converts the raw text inside a frontmatter fence into a FrontmatterData
 * object. Each line is split on the first `:` to produce a key-value pair.
 * Unrecognised keys are silently skipped.
 *
 * @param {string} block - Raw text between the opening and closing `---` fences
 * @returns {FrontmatterData} Structured metadata extracted from the block
 * @version 1.1.1
 */
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
      case 'project':
        data.project = value;
        break;
      case 'issuetype':
      case 'issue_type':
      case 'type':
        data.issuetype = value;
        break;
      case 'priority':
        data.priority = value;
        break;
      default:
        break;
    }
  }

  return data;
}

/**
 * Splits a comma-separated value string and trims whitespace from each entry.
 * Empty entries produced by trailing commas or double-commas are removed.
 *
 * @param {string} value - Raw comma-separated string from a frontmatter field
 * @returns {string[]} Array of trimmed, non-empty string values
 * @version 1.1.1
 */
function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
