// ============================================================================
// CreateSocialEvent wizard — shared form state + validation contract
// ----------------------------------------------------------------------------
// Single source of truth shared between the wizard container (state owner)
// and the two Step* components (view + onChange/onBlur). Validation lives
// here so submit + per-field hints + the "Next button enabled" gate all
// agree on what's valid.
// ============================================================================

import type { Translations } from "@/i18n/vi";

export interface FormState {
  /** Stored in social_events.title_vi; title_en is left null on insert. */
  title: string;
  /** Stored in description_vi; description_en is left null. */
  description: string;
  /** YYYY-MM-DD (local). */
  start_date: string;
  /** HH:MM (local, 24h). */
  start_time: string;
  /** HH:MM (local, 24h). */
  end_time: string;
  location_text: string;
  court_count: number;
  max_players: number;
  zalo_group_url: string;
  visibility: "public" | "club_only";
  /** Step 2 only. VND, integer >= 0. */
  price_vnd: number;
}

export type FormErrors = Partial<Record<keyof FormState, string | null>>;

export const initialForm: FormState = {
  title: "",
  description: "",
  start_date: "",
  start_time: "",
  end_time: "",
  location_text: "",
  court_count: 2,
  max_players: 16,
  zalo_group_url: "",
  visibility: "public",
  price_vnd: 0,
};

const MAX_PRICE_VND = 10_000_000;

/**
 * Returns the validation error string for a single field, or null if the
 * value is valid. Pure — no side effects. Receives the whole form so
 * cross-field rules (end_time > start_time) can reach the other field.
 */
export function validateField(
  field: keyof FormState,
  form: FormState,
  t: Translations,
): string | null {
  const create = t.socialEvents.create;
  const value = form[field];

  switch (field) {
    case "title": {
      const v = String(value).trim();
      if (v.length === 0) return create.errorRequired;
      if (v.length < 3) return create.errorTitleMin;
      if (v.length > 200) return create.errorTitleMax;
      return null;
    }

    case "description":
      // Optional; only length-cap on submit (handled by server).
      return null;

    case "start_date": {
      const v = String(value);
      if (v.length === 0) return create.errorRequired;
      // Compare against today at local midnight — today is allowed,
      // anything strictly before is rejected.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parsed = new Date(`${v}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return create.errorRequired;
      if (parsed.getTime() < today.getTime()) return create.errorPastDate;
      return null;
    }

    case "start_time":
      return String(value).length === 0 ? create.errorRequired : null;

    case "end_time": {
      const v = String(value);
      if (v.length === 0) return create.errorRequired;
      if (!form.start_time) return null; // start_time own error fires first
      // HH:MM strings sort lexically the same as time-of-day.
      if (v <= form.start_time) return create.errorTimeOrder;
      return null;
    }

    case "location_text": {
      const v = String(value).trim();
      if (v.length === 0) return create.errorRequired;
      if (v.length < 3) return create.errorLocationMin;
      return null;
    }

    case "court_count": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) return create.errorCourtCountMin;
      return null;
    }

    case "max_players": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 4) return create.errorMaxPlayersMin;
      return null;
    }

    case "zalo_group_url": {
      const v = String(value).trim();
      if (v.length === 0) return null;
      try {
        // URL constructor throws on invalid input.
        const u = new URL(v);
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          return create.errorZaloUrl;
        }
        return null;
      } catch {
        return create.errorZaloUrl;
      }
    }

    case "visibility":
      return null;

    case "price_vnd": {
      const n = Number(value);
      if (!Number.isInteger(n)) return create.errorPriceNeg;
      if (n < 0) return create.errorPriceNeg;
      if (n > MAX_PRICE_VND) return create.errorPriceTooLarge;
      return null;
    }
  }
}

const STEP1_FIELDS: ReadonlyArray<keyof FormState> = [
  "title",
  "description",
  "start_date",
  "start_time",
  "end_time",
  "location_text",
  "court_count",
  "max_players",
  "zalo_group_url",
  "visibility",
];

const STEP2_FIELDS: ReadonlyArray<keyof FormState> = ["price_vnd"];

/**
 * Validate every Step-1 field. Returns a per-field error map and a single
 * `valid` boolean (true iff every entry is null/missing).
 */
export function validateStep1(form: FormState, t: Translations): { errors: FormErrors; valid: boolean } {
  const errors: FormErrors = {};
  let valid = true;
  for (const f of STEP1_FIELDS) {
    const e = validateField(f, form, t);
    errors[f] = e;
    if (e) valid = false;
  }
  return { errors, valid };
}

export function validateStep2(form: FormState, t: Translations): { errors: FormErrors; valid: boolean } {
  const errors: FormErrors = {};
  let valid = true;
  for (const f of STEP2_FIELDS) {
    const e = validateField(f, form, t);
    errors[f] = e;
    if (e) valid = false;
  }
  return { errors, valid };
}
