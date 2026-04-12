import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useDraft — persists form state to localStorage so unsaved data survives
 * tab switches and navigation. Clears the draft when `clearDraft()` is called
 * (typically in the mutation's onSuccess callback).
 *
 * Key design: only writes to localStorage when `markDirty()` has been called,
 * which prevents programmatic setForm calls (e.g. server-load effects) from
 * being mistaken for real user drafts.
 *
 * @param key     Unique localStorage key for this draft (e.g. "draft:dailyLog:2026-04-06")
 * @param initial Initial / default form value
 */
export function useDraft<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>, (resetTo?: T) => void, () => void, boolean] {
  // isDirtyRef: true only when the user has made a real edit (not a programmatic setForm)
  const isDirtyRef = useRef<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const [value, setValueRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        isDirtyRef.current = true;
        return JSON.parse(stored) as T;
      }
    } catch {
      // ignore parse errors
    }
    return initial;
  });

  // Persist to localStorage only when dirty
  useEffect(() => {
    if (!isDirtyRef.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new Event("draft-changed"));
    } catch {
      // ignore quota errors
    }
  }, [key, value]);

  // When the key changes (e.g. date changes), reload from storage or fall back to initial
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        isDirtyRef.current = true;
        setIsDirty(true);
        setValueRaw(JSON.parse(stored) as T);
        return;
      }
    } catch {
      // ignore
    }
    isDirtyRef.current = false;
    setIsDirty(false);
    setValueRaw(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** Call this when the user explicitly changes the form (not programmatic loads) */
  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    setIsDirty(true);
  }, []);

  const clearDraft = useCallback((resetTo?: T) => {
    isDirtyRef.current = false;
    setIsDirty(false);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    // Notify listeners (e.g. DashboardShell amber dot) that a draft was cleared
    window.dispatchEvent(new Event("draft-changed"));
    // Reset in-memory state so the form reflects the cleared/reset value immediately
    if (resetTo !== undefined) setValueRaw(resetTo);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return [value, setValueRaw, clearDraft, markDirty, isDirty];
}
