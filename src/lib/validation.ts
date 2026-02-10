/**
 * Shared input validation utilities for preventing abuse and data corruption.
 */

/** Trim and truncate a string to maxLength */
export function sanitizeString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

/** Check if a string exceeds max length. Returns error message or null. */
export function validateMaxLength(value: string, max: number, fieldName: string): string | null {
  if (value.trim().length > max) {
    return `${fieldName} không được vượt quá ${max} ký tự`;
  }
  return null;
}

/** Validate URL - only allow http:// and https:// */
export function validateUrl(value: string): boolean {
  if (!value || !value.trim()) return true; // empty is OK (optional field)
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Validate UUID v4 format */
export function validateUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Sanitize a profile link - return cleaned URL or null if invalid */
export function sanitizeProfileLink(value: string | undefined | null): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  if (!validateUrl(trimmed)) return null;
  return trimmed;
}
