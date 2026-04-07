/**
 * Shared statistics utilities — import these instead of redefining per component.
 */

/**
 * Average an array of nullable numbers, ignoring nulls/undefined.
 * Returns null if no valid numbers exist.
 * Result is rounded to 1 decimal place.
 */
export function avgNullable(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null);
  return nums.length
    ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1))
    : null;
}

/**
 * Calculate percentage change from prev to cur.
 * Returns a formatted string like "+2.3%" or "-1.5%", or null if either value is missing/zero.
 */
export function pctChange(cur: number | null, prev: number | null): string | null {
  if (cur == null || prev == null || prev === 0) return null;
  const pct = ((cur - prev) / prev) * 100;
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
}

/**
 * Sum an array of nullable numbers, treating null/undefined as 0.
 */
export function sumNullable(vals: (number | null | undefined)[]): number {
  return vals.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}
