/**
 * Shared date utilities — import these instead of redefining per component.
 *
 * KEY RULE: MySQL DATE columns are stored as the correct calendar date and
 * returned as UTC midnight timestamps (e.g. "2026-04-07T00:00:00.000Z").
 * Always use UTC date parts when converting DB timestamps to yyyy-mm-dd strings.
 * Using local date parts would shift the date back by one day for users in
 * positive UTC offsets (e.g. AEST UTC+10).
 */

/**
 * Convert a DB date value (ISO timestamp or plain date string) to yyyy-mm-dd
 * using UTC date parts. Safe for all timezones.
 */
export function toUTCDateStr(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  if (s.includes("T") || s.includes("Z")) {
    const d = new Date(s);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return s.slice(0, 10);
}

/**
 * Today's date in the user's LOCAL timezone as yyyy-mm-dd.
 * Used for "today" comparisons and form defaults — not for DB timestamps.
 */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Format a yyyy-mm-dd string as "13 May 2026" for display.
 */
export function fmtDate(iso: unknown): string {
  const s = String(iso ?? "").slice(0, 10);
  if (!s || s.length < 10) return s;
  const d = new Date(s + "T12:00:00Z");
  const day = d.getUTCDate();
  const month = d.toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format a yyyy-mm-dd string as e.g. "Wed April 08" for display.
 * Uses noon UTC to avoid DST boundary issues.
 */
export function fmtDateLong(iso: unknown): string {
  const s = String(iso ?? "").slice(0, 10);
  if (!s || s.length < 10) return s;
  const d = new Date(s + "T12:00:00Z");
  const weekday = d.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" });
  const month = d.toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${weekday} ${month} ${day}`;
}

/**
 * Short weekday label (e.g. "Mon") for a yyyy-mm-dd string.
 * Uses noon UTC to avoid DST boundary issues.
 */
export function dayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-AU", { weekday: "short" });
}

/**
 * Build an array of the last N calendar days (today first) as yyyy-mm-dd strings.
 */
export function lastNDays(n: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return result;
}

/**
 * Return the yyyy-mm-dd string for N days ago (local timezone).
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
