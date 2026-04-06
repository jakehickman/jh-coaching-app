import { useState, useEffect, useCallback } from "react";

/**
 * useDraft — persists form state to localStorage so unsaved data survives
 * tab switches and navigation. Clears the draft when `clearDraft()` is called
 * (typically in the mutation's onSuccess callback).
 *
 * @param key     Unique localStorage key for this draft (e.g. "draft:dailyLog:2026-04-06")
 * @param initial Initial / default form value
 */
export function useDraft<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [value, setValueRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored) as T;
    } catch {
      // ignore parse errors
    }
    return initial;
  });

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota errors
    }
  }, [key, value]);

  // When the key changes (e.g. date changes), reload from storage or fall back to initial
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setValueRaw(JSON.parse(stored) as T);
        return;
      }
    } catch {
      // ignore
    }
    setValueRaw(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key]);

  return [value, setValueRaw, clearDraft];
}
