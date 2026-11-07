/**
 * Pure Validation Schemas and Field Helpers
 * Eliminates unreliable HTML5 native required bubbles (B6) and enforces min note rules (B23).
 */

export const validators = {
  required: (val: unknown, fieldName = 'This field'): string | null => {
    if (val === undefined || val === null) return `${fieldName} is required.`;
    if (typeof val === 'string' && val.trim().length === 0) return `${fieldName} is required.`;
    return null;
  },

  minAuditNote: (val: string, minLength = 4): string | null => {
    if (!val || val.trim().length < minLength) {
      return `Mandatory audit note must be at least ${minLength} characters explaining this transaction.`;
    }
    if (val.trim().length > 500) {
      return 'Audit note cannot exceed 500 characters.';
    }
    return null;
  },

  positiveNumber: (val: string | number, fieldName = 'Amount'): string | null => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num) || num <= 0) {
      return `${fieldName} must be a valid positive number greater than zero.`;
    }
    return null;
  },

  nonNegativeNumber: (val: string | number, fieldName = 'Amount'): string | null => {
    if (val === '' || val === undefined || val === null) return null;
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num) || num < 0) {
      return `${fieldName} must be a number greater than or equal to zero.`;
    }
    return null;
  },

  positiveInteger: (val: string | number, fieldName = 'Quantity'): string | null => {
    const num = typeof val === 'number' ? val : parseInt(val, 10);
    if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
      return `${fieldName} must be a whole positive number (at least 1).`;
    }
    return null;
  },

  futureDate: (val: string, fieldName = 'Date'): string | null => {
    if (!val) return `${fieldName} is required.`;
    const d = new Date(val);
    if (isNaN(d.getTime())) return `Please select a valid ${fieldName.toLowerCase()}.`;
    return null;
  },

  contact: (val: string, fieldName = 'Phone or Email'): string | null => {
    if (!val || val.trim().length < 3) return `${fieldName} is required (at least 3 characters).`;
    return null;
  },
};

