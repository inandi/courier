/**
 * Template resolution: project → user default → built-in LineOne
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseLineOne, ParsedDraft } from './lineOne';

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
 * Currently only supports LineOne; other types fall back to LineOne.
 */
export function parseWithTemplate(content: string, template: CourierTemplate): ParsedDraft | null {
  if (template.type === 'lineOne') {
    return parseLineOne(content);
  }
  // Future: frontmatter, heading, sections
  return parseLineOne(content);
}
