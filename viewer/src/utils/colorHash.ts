// Deterministic color generation from strings

// Color palette that works well on dark backgrounds
const COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#a855f7', // purple
  '#f43f5e', // rose
];

// Simple hash function for consistent results
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a deterministic color from an entity type string
 */
export function getTypeColor(type: string): string {
  const index = hashString(type) % COLORS.length;
  return COLORS[index];
}

/**
 * Get a deterministic color from an epic name string
 */
export function getEpicColor(epic: string): string {
  if (!epic) return COLORS[0];
  const index = hashString(epic) % COLORS.length;
  return COLORS[index];
}

/**
 * Get a lighter version of a color for backgrounds
 */
export function getLightColor(color: string, opacity: number = 0.2): string {
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
}
