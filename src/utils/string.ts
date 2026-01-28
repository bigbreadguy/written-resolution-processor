/**
 * Mask a sensitive string (e.g., API key) for display
 * Shows first 8 and last 4 characters with ellipsis in between
 */
export function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}
