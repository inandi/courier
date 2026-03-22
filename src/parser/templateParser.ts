/**
 * Courier Template Parser
 *
 * Resolves which parsing template to use for a given workspace and applies it
 * to raw Markdown content. Template resolution follows a priority chain:
 * project-local JSON file → user VS Code setting → built-in LineOne default.
 * Frontmatter is always stripped first and its metadata merged into the
 * resulting ParsedDraft before the draft is returned to the caller.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseLineOne, ParsedDraft } from './lineOne';
import { parseFrontmatter } from './frontmatter';

/**
 * Describes a Courier template configuration object.
 * Currently only the built-in `lineOne` type is supported; the interface is
 * intentionally open (index signature) to allow future custom template types
 * without breaking existing configurations.
 *
 * @version 1.1.1
 */
export interface CourierTemplate {
  /** Template type identifier. Supported value: `"lineOne"`. */
  type: string;
  /** 1-based line number that contains the issue title (lineOne default: 1). */
  titleLine?: number;
  /** 1-based line number from which the body starts (lineOne default: 2). */
  bodyFrom?: number;
  [key: string]: unknown;
}

/** Built-in fallback template — always available, no configuration required. */
const DEFAULT_TEMPLATE: CourierTemplate = { type: 'lineOne', titleLine: 1, bodyFrom: 2 };

/** Relative paths searched in order when looking for a project-local template file. */
const TEMPLATE_FILES = [
  '.vscode/courier.template.json',
  'courier.template.json',
];

/**
 * Resolves the active Courier template for the given workspace root.
 * Resolution priority: project-local JSON file → `courier.defaultTemplate`
 * VS Code setting → built-in LineOne fallback. The first match wins.
 *
 * @param {string} workspaceRoot - Absolute path to the workspace root folder
 * @returns {CourierTemplate} The resolved template configuration object
 * @version 1.1.1
 */
export function resolveTemplate(workspaceRoot: string): CourierTemplate {
  return (
    resolveProjectTemplate(workspaceRoot) ??
    resolveUserDefaultTemplate() ??
    DEFAULT_TEMPLATE
  );
}

/**
 * Attempts to load a template from a project-local JSON file.
 * Searches the paths listed in TEMPLATE_FILES relative to the workspace root.
 * Invalid JSON or missing `type` fields cause the file to be silently skipped.
 *
 * @param {string} workspaceRoot - Absolute path to the workspace root folder
 * @returns {CourierTemplate | null} Parsed template or null if none found
 * @version 1.1.1
 */
function resolveProjectTemplate(workspaceRoot: string): CourierTemplate | null {
  for (const rel of TEMPLATE_FILES) {
    const fullPath = path.join(workspaceRoot, rel);
    if (fs.existsSync(fullPath)) {
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(raw) as CourierTemplate;
        if (parsed?.type) {
          return parsed;
        }
      } catch {
        // Invalid JSON or missing type — skip and try next candidate.
      }
    }
  }
  return null;
}

/**
 * Reads the `courier.defaultTemplate` workspace setting and returns it as a
 * CourierTemplate if the object is valid (has a `type` string property).
 *
 * @returns {CourierTemplate | null} User-configured template or null if unset/invalid
 * @version 1.1.1
 */
function resolveUserDefaultTemplate(): CourierTemplate | null {
  const config = vscode.workspace.getConfiguration('courier');
  const raw = config.get<CourierTemplate | undefined>('defaultTemplate');
  if (raw && typeof raw === 'object' && raw.type) {
    return raw;
  }
  return null;
}

/**
 * Parses raw Markdown file content using the supplied template.
 * Frontmatter (the `---` block) is always stripped first; its metadata is
 * extracted and merged into the ParsedDraft returned to the caller. If the
 * remaining content cannot be parsed (e.g. completely blank), null is returned.
 *
 * @param {string} content - Raw text content of the Markdown file
 * @param {CourierTemplate} template - Resolved template to apply during parsing
 * @returns {ParsedDraft | null} Parsed draft with merged metadata, or null if unparseable
 * @version 1.1.1
 */
export function parseWithTemplate(content: string, template: CourierTemplate): ParsedDraft | null {
  const { data, content: body } = parseFrontmatter(content);

  let draft: ParsedDraft | null;
  if (template.type === 'lineOne') {
    draft = parseLineOne(body);
  } else {
    draft = parseLineOne(body);
  }

  if (!draft) return null;

  // Merge frontmatter metadata into the parsed draft.
  if (data.labels?.length) draft.labels = data.labels;
  if (data.assignees?.length) draft.assignees = data.assignees;
  if (data.milestone !== undefined) draft.milestone = data.milestone;
  if (data.project) draft.project = data.project;
  if (data.issuetype) draft.issuetype = data.issuetype;
  if (data.priority) draft.priority = data.priority;

  return draft;
}
