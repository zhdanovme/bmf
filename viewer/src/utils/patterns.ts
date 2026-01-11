// Shared patterns for BMF reference extraction

// Pattern to match $ references: $type.path or $type:path or $type.path(params)
export const REFERENCE_PATTERN = /\$([a-z]+)[.:]([a-z0-9._:-]+)/i;

// Pattern to match bare component references in "for each" loops: component:epic:name
export const BARE_COMPONENT_PATTERN = /\bcomponent:([a-z0-9._:-]+)/i;

// Global versions for multiple matches
export const REFERENCE_PATTERN_GLOBAL = /\$([a-z]+)[.:]([a-z0-9._:-]+)/gi;
export const BARE_COMPONENT_PATTERN_GLOBAL = /\bcomponent:([a-z0-9._:-]+)/gi;

/**
 * Extract reference from a string value
 * Returns normalized reference in format type:epic:name
 */
export function extractReference(value: string): { reference: string; referenceType: string } | null {
  // Try $ prefixed reference first
  const match = REFERENCE_PATTERN.exec(value);
  if (match) {
    const referenceType = match[1];
    const refPath = match[2];
    return {
      reference: `${referenceType}:${refPath.replace(/\./g, ':')}`,
      referenceType,
    };
  }

  // Try bare component reference (e.g., in "for each" loops)
  const bareMatch = BARE_COMPONENT_PATTERN.exec(value);
  if (bareMatch) {
    const refPath = bareMatch[1];
    return {
      reference: `component:${refPath.replace(/\./g, ':')}`,
      referenceType: 'component',
    };
  }

  return null;
}
