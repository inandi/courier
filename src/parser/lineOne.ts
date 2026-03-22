/**
 * Courier LineOne Parser
 *
 * Parses Markdown draft files using the LineOne convention: the first
 * non-empty line becomes the issue title and all subsequent lines become
 * the issue body. Also defines the shared ParsedDraft interface that
 * carries both content and optional frontmatter metadata for GitHub and Jira.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

/**
 * Represents a fully parsed Markdown draft ready for issue creation.
 * The title and body fields come from the file content; all other fields
 * are populated from YAML-lite frontmatter by the template parser.
 *
 * @version 1.1.1
 */
export interface ParsedDraft {
  /** Issue title — derived from the first non-empty line of the file. */
  title: string;
  /** Issue body — all lines after the title, joined and trimmed. */
  body: string;
  // ------------------------------------------------------------------
  // GitHub-specific metadata (from frontmatter)
  // ------------------------------------------------------------------
  /** GitHub labels to apply to the issue (from frontmatter `labels:`). */
  labels?: string[];
  /** GitHub usernames to assign to the issue (from frontmatter `assignees:`). */
  assignees?: string[];
  /** GitHub milestone number to attach to the issue (from frontmatter `milestone:`). */
  milestone?: number;
  // ------------------------------------------------------------------
  // Jira-specific metadata (from frontmatter)
  // ------------------------------------------------------------------
  /** Jira project key, e.g. `"PROJ"` (from frontmatter `project:`). */
  project?: string;
  /** Jira issue type name, e.g. `"Story"` (from frontmatter `issuetype:`). */
  issuetype?: string;
  /** Jira priority name, e.g. `"High"` (from frontmatter `priority:`). */
  priority?: string;
}

/**
 * Parses Markdown file content using the LineOne format.
 * The first non-empty line is treated as the issue title; every line that
 * follows becomes the body. Leading/trailing whitespace on the body is
 * trimmed but internal blank lines are preserved.
 * Returns null when the content contains no non-empty lines.
 *
 * @param {string} content - Raw text content of the Markdown file
 * @returns {ParsedDraft | null} Parsed title and body, or null if content is blank
 * @version 1.1.1
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
