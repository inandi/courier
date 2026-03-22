/**
 * Courier Parser Public API
 *
 * Re-exports the public surface of the parser sub-package so callers can
 * import everything they need from a single path (`./parser`).
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1 [22-03-2026]
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

export { parseLineOne, ParsedDraft } from './lineOne';
export {
  resolveTemplate,
  parseWithTemplate,
  CourierTemplate,
} from './templateParser';
export { parseFrontmatter, FrontmatterData, FrontmatterResult } from './frontmatter';
