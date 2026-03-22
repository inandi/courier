/**
 * Template resolution: project → user default → built-in LineOne
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseLineOne, ParsedDraft } from './lineOne';
import { parseFrontmatter } from './frontmatter';

export interface CourierTemplate {
  type: string;
  titleLine?: number;
  bodyFrom?: number;
  [key: string]: unknown;
}

const DEFAULT_TEMPLATE: CourierTemplate = { type: 'lineOne', titleLine: 1, bodyFrom: 2 };

const TEMPLATE_FILES = [
  '.vscode/courier.template.json',
  'courier.template.json',
];

/**
 * Resolve template from project → user default → built-in LineOne
 */
export function resolveTemplate(workspaceRoot: string): CourierTemplate {
  return (
    resolveProjectTemplate(workspaceRoot) ??
    resolveUserDefaultTemplate() ??
    DEFAULT_TEMPLATE
  );
}

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
        // Invalid JSON or missing type - skip
      }
    }
  }
  return null;
}

function resolveUserDefaultTemplate(): CourierTemplate | null {
  const config = vscode.workspace.getConfiguration('courier');
  const raw = config.get<CourierTemplate | undefined>('defaultTemplate');
  if (raw && typeof raw === 'object' && raw.type) {
    return raw;
  }
  return null;
}

/**
 * Parse .md content using the resolved template.
 * Frontmatter (---) is always stripped first and its metadata merged into the result.
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
