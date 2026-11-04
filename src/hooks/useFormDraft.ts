import { useState, useEffect } from 'react';

export function useFormDraft<T>(key: string | undefined, initialValues: T): [T, (values: T) => void, () => void] {
  const storageKey = key ? `capita_form_draft_${key}` : null;

  const [draft, setDraftState] = useState<T>(() => {
    if (!storageKey || typeof sessionStorage === 'undefined') return initialValues;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        return { ...initialValues, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return initialValues;
  });

  const saveDraft = (values: T) => {
    setDraftState(values);
    if (!storageKey || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
      // Ignore quota
    }
  };

  const clearDraft = () => {
    setDraftState(initialValues);
    if (!storageKey || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (!storageKey || typeof sessionStorage === 'undefined') return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        setDraftState({ ...initialValues, ...JSON.parse(saved) });
      }
    } catch {
      // Ignore
    }
  }, [storageKey]);

  return [draft, saveDraft, clearDraft];
}

