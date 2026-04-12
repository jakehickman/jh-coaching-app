import { useState, useEffect, useCallback } from "react";

/**
 * useDraft — simple localStorage persistence for form state.
 *
 * Design principles:
 * - The hook owns the form value and persists it to localStorage on every change.
 * - `isDirty` is true only after the caller explicitly calls `setDirty(true)`.
 *   Programmatic loads (server data, date changes) should NOT call setDirty.
 * - `clearDraft()` removes the key, resets isDirty, and dispatches "draft-changed"
 *   so any amber-dot listeners update immediately.
 *
 * Usage:
 *   const { form, setForm, isDirty, setDirty, clearDraft } = useDraft(key, blank);
 *
 *   // When user types:
 *   onChange={e => { setDirty(true); setForm(p => ({ ...p, field: e.target.value })); }}
 *
 *   // When loading server data (not a user edit):
 *   setForm(serverData);  // isDirty stays unchanged
 *
 *   // After successful save:
 *   clearDraft();  // removes key, sets isDirty=false, fires draft-changed
 */
export function useDraft<T>(key: string, blank: T) {
  // Initialise from localStorage if a draft exists, otherwise use blank
  const [form, setFormRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored) as T;
    } catch { /* ignore */ }
    return blank;
  });

  // isDirty: true only when the user has explicitly edited the form
  const [isDirty, setDirty] = useState<boolean>(() => {
    return localStorage.getItem(key) !== null;
  });

  // Persist to localStorage whenever form changes AND isDirty is true
  useEffect(() => {
    if (!isDirty) return;
    try {
      localStorage.setItem(key, JSON.stringify(form));
      window.dispatchEvent(new Event("draft-changed"));
    } catch { /* ignore quota errors */ }
  }, [key, form, isDirty]);

  // When the key changes (date changes), reload from storage or fall back to blank
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setFormRaw(JSON.parse(stored) as T);
        setDirty(true);
        return;
      }
    } catch { /* ignore */ }
    setFormRaw(blank);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    setDirty(false);
    window.dispatchEvent(new Event("draft-changed"));
    // Note: does NOT reset form — caller decides what to show after save
  }, [key]);

  return { form, setForm: setFormRaw, isDirty, setDirty, clearDraft };
}
