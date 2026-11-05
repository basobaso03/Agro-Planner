import React, { useState, useRef, useCallback } from 'react';
import { useFormDraft } from './useFormDraft.ts';
import { nativeHaptics } from '../native/haptics.ts';
import { getFriendlyErrorMessage } from '../utils/errors.ts';

export interface UseFormOptions<T> {
  initial: T;
  draftKey?: string;
  validate: (values: T) => Partial<Record<keyof T | string, string | null>>;
  crossValidate?: (values: T) => Partial<Record<keyof T | string, string | null>> | null;
  onSubmit: (values: T, idempotencyKey: string) => Promise<void>;
  onSuccess?: () => void;
}

export function useForm<T extends Record<string, any>>(options: UseFormOptions<T>) {
  const [draft, setDraft, clearDraft] = useFormDraft<T>(options.draftKey, options.initial);
  const [values, setValuesState] = useState<T>(draft);
  const [errors, setErrors] = useState<Partial<Record<keyof T | string, string>>>({});
  const [stickyError, setStickyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const idempotencyKeyRef = useRef<string>(`IDEM_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

  const setValues = useCallback(
    (newValues: Partial<T> | ((prev: T) => T), markDirty = false) => {
      setValuesState((prev) => {
        const next =
          typeof newValues === 'function'
            ? (newValues as (prev: T) => T)(prev)
            : { ...prev, ...newValues };
        setDraft(next);
        return next;
      });
      setIsDirty(markDirty);
      setErrors({});
      if (stickyError) {
        setStickyError(null);
      }
    },
    [stickyError, setDraft]
  );

  const setFieldValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValuesState((prev) => {
        const next = { ...prev, [field]: value };
        setDraft(next);
        return next;
      });
      setIsDirty(true);
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
      if (stickyError) {
        setStickyError(null);
      }
    },
    [errors, stickyError, setDraft]
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isSubmitting) return;

    // Validate
    const fieldErrors = options.validate(values);
    const crossErrors = options.crossValidate ? options.crossValidate(values) : null;
    const combinedErrors: Partial<Record<keyof T, string>> = {};

    let hasErrors = false;
    for (const [key, msg] of Object.entries(fieldErrors)) {
      if (msg) {
        combinedErrors[key as keyof T] = msg as string;
        hasErrors = true;
      }
    }
    if (crossErrors) {
      for (const [key, msg] of Object.entries(crossErrors)) {
        if (msg) {
          combinedErrors[key as keyof T] = msg as string;
          hasErrors = true;
        }
      }
    }

    if (hasErrors) {
      setErrors(combinedErrors);
      const firstErrorMsg = Object.values(combinedErrors)[0] || 'Please complete all required fields.';
      setStickyError(firstErrorMsg);
      void nativeHaptics.error();

      // Auto-scroll to first invalid input
      if (typeof document !== 'undefined') {
        setTimeout(() => {
          const firstInvalidInput = document.querySelector('[data-invalid="true"], [aria-invalid="true"]');
          if (firstInvalidInput instanceof HTMLElement) {
            firstInvalidInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstInvalidInput.focus();
          }
        }, 60);
      }
      return;
    }

    setErrors({});
    setStickyError(null);
    setIsSubmitting(true);

    try {
      await options.onSubmit(values, idempotencyKeyRef.current);
      void nativeHaptics.success();
      clearDraft();
      setIsDirty(false);
      // Generate next idempotency key for next opening
      idempotencyKeyRef.current = `IDEM_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      if (options.onSuccess) {
        options.onSuccess();
      }
    } catch (err: unknown) {
      const msg = getFriendlyErrorMessage(err);
      setStickyError(msg);
      void nativeHaptics.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = (newValues?: T) => {
    setValuesState(newValues ?? options.initial);
    clearDraft();
    setErrors({});
    setStickyError(null);
    setIsDirty(false);
  };

  return {
    values,
    setFieldValue,
    setValue: setFieldValue,
    setValues,
    setvalues: setValues,
    errors,
    stickyError,
    setStickyError,
    isSubmitting,
    isDirty,
    handleSubmit,
    reset,
  };
}

