/**
 * Helper to create a diff between old and new data.
 * Useful for showing what changed in the activity log.
 */
export function createAuditDiff(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): { changed: Record<string, { old: unknown; new: unknown }> } {
  const changed: Record<string, { old: unknown; new: unknown }> = {};
  
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  for (const key of allKeys) {
    const oldVal = oldData[key];
    const newVal = newData[key];
    
    // Skip if both undefined or null
    if (oldVal === undefined && newVal === undefined) continue;
    if (oldVal === null && newVal === null) continue;
    
    // Check if values differ
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changed[key] = { old: oldVal, new: newVal };
    }
  }
  
  return { changed };
}
