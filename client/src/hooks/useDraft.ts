import { useState, useEffect, useCallback } from "react";

/**
 * useDraft — simple localStorage persistence for form state.
 *
 * Rules:
 * - `isDirty` starts true only if a key already exists in localStorage on mount.
 * - `setDirty(true)` is called by the consumer on every user-initiated change.
 * - When `isDirty` is true, form changes are written to localStorage.
 * - `clearDraft()` removes the key, sets isDirty=false, dispatches "draft-changed".
 * - "draft-changed" is ALWAYS dispatched whenever isDirty changes so listeners stay in sync.
 */
export function useDraft<T>(key: string, blank: T) {
  const [form, setFormRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored) as T;
    } catch { /* ignore */ }
    return blank;
  });

  const [isDirty, setDirtyRaw] = useState<boolean>(() => {
    return localStorage.getItem(key) !== null;
  });

  // Persist to localStorage and notify listeners whenever form or isDirty changes
  useEffect(() => {
    if (isDirty) {
      try { localStorage.setItem(key, JSON.stringify(form)); } catch { /* ignore quota */ }
    } else {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
    // Always dispatch so DashboardShell amber dot stays in sync
    window.dispatchEvent(new Event("draft-changed"));
  }, [key, form, isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the key changes (date changes), reload from storage or fall back to blank
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setFormRaw(JSON.parse(stored) as T);
        setDirtyRaw(true);
        return;
      }
    } catch { /* ignore */ }
    setFormRaw(blank);
    setDirtyRaw(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setDirty = useCallback((dirty: boolean) => {
    setDirtyRaw(dirty);
  }, []);

  const clearDraft = useCallback(() => {
    setDirtyRaw(false);
    // localStorage removal and draft-changed dispatch happen in the persist effect above
  }, []);

  return { form, setForm: setFormRaw, isDirty, setDirty, clearDraft };
}
