// ============================================================================
// CreateSocialEvent wizard — shared form state + validation contract
// ----------------------------------------------------------------------------
// Single source of truth shared between the wizard container (state owner)
// and the two Step* components (view + onChange/onBlur). Validation lives
// here so submit + per-field hints + the "Next button enabled" gate all
// agree on what's valid.
// ============================================================================

import type { Translations } from "@/i18n/vi";

/**
 * One registration slot (optional event sub-bucket). Organizer can add 0..N.
 * - "skill"    → có skill_level ("2.5", "3.0", "newbie", ...)
 * - "duration" → có min_play_months (6 = "đã chơi tối thiểu 6 tháng")
 * - "general"  → free-text, không gắn metadata
 *
 * `id` được tự sinh client-side và phải unique trong cùng event. `capacity`
 * mặc định = court_count * 4 nhưng organizer có thể override.
 */
export type SlotKind = "skill" | "duration" | "general";

export interface SlotConfig {
  id: string;
  label: string;
  kind: SlotKind;
  capacity: number;
  court_count?: number | null;
  skill_level?: string | null;
  min_play_months?: number | null;
  notes?: string | null;
}

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
  /** Step 2. VND, integer >= 0. */
  price_vnd: number;
  /** Step 2 bank fields — PR51 moves payment config onto the event. */
  bank_code: string;
  bank_account_number: string;
  bank_account_name: string;
  /** PR67 — prepayment toggle + deadline window (hours). */
  requires_prepayment: boolean;
  prepayment_deadline_hours: number;
  /**
   * Optional registration slots. Empty array = no slots; player gates only
   * on max_players. When non-empty, sum(capacity) must ≤ max_players and
   * the player must pick exactly one slot at registration time.
   */
  slots: SlotConfig[];
  /**
   * Weekly-repeat count. 0 = no repeat (single event), N = create N
   * additional events 7, 14, …, 7N days after the base event with
   * identical fields. Capped at 12 weeks (one quarter) to keep slug
   * collisions + DB load manageable.
   */
  repeat_weeks: number;
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
  bank_code: "",
  bank_account_number: "",
  bank_account_name: "",
  requires_prepayment: false,
  prepayment_deadline_hours: 12,
  slots: [],
  repeat_weeks: 0,
};

/**
 * Generate a stable but unique slot id (16-hex). Lives in the client so
 * organizers can rearrange slots before submit without colliding.
 */
export function newSlotId(): string {
  const r = new Uint8Array(8);
  crypto.getRandomValues(r);
  return Array.from(r, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build an empty slot with sensible defaults for the requested kind.
 * `court_count = 1`, `capacity = 4` is a safe seed (4 chỗ / sân).
 */
export function makeEmptySlot(kind: SlotKind): SlotConfig {
  return {
    id: newSlotId(),
    label: "",
    kind,
    capacity: 4,
    court_count: kind === "skill" ? 1 : null,
    skill_level: kind === "skill" ? "" : null,
    min_play_months: kind === "duration" ? 6 : null,
    notes: null,
  };
}

/**
 * Validate a single slot. Returns a per-field map (label/capacity/etc.)
 * with error strings keyed by slot id + field, or null when slot is OK.
 * Used by the Step1Info slot manager to surface inline errors.
 */
export interface SlotErrors {
  label?: string | null;
  capacity?: string | null;
  skill_level?: string | null;
  min_play_months?: string | null;
}

const MAX_SLOTS = 12;
const MAX_SLOT_CAPACITY = 200;
const MAX_PLAY_MONTHS = 360;

export function validateSlot(slot: SlotConfig, t: Translations): SlotErrors {
  const create = t.socialEvents.create;
  const errs: SlotErrors = {};
  const label = (slot.label ?? "").trim();
  if (label.length < 2) {
    errs.label = create.errorSlotLabelMin;
  } else if (label.length > 80) {
    errs.label = create.errorSlotLabelMax;
  }
  if (!Number.isInteger(slot.capacity) || slot.capacity < 1) {
    errs.capacity = create.errorSlotCapacityMin;
  } else if (slot.capacity > MAX_SLOT_CAPACITY) {
    errs.capacity = create.errorSlotCapacityMax;
  }
  if (slot.kind === "skill") {
    const lvl = (slot.skill_level ?? "").trim();
    if (lvl.length === 0) errs.skill_level = create.errorSlotSkillRequired;
  }
  if (slot.kind === "duration") {
    const m = slot.min_play_months;
    if (m == null || !Number.isInteger(m) || m < 0 || m > MAX_PLAY_MONTHS) {
      errs.min_play_months = create.errorSlotDurationRange;
    }
  }
  return errs;
}

export function validateSlots(
  slots: SlotConfig[],
  maxPlayers: number,
  t: Translations,
): { errors: Record<string, SlotErrors>; totalError: string | null; valid: boolean } {
  const create = t.socialEvents.create;
  const errors: Record<string, SlotErrors> = {};
  let valid = true;

  if (slots.length > MAX_SLOTS) {
    return {
      errors,
      totalError: create.errorSlotTooMany,
      valid: false,
    };
  }

  const seenIds = new Set<string>();
  for (const slot of slots) {
    if (seenIds.has(slot.id)) {
      // Id collision shouldn't happen via the UI but guard anyway.
      errors[slot.id] = { label: create.errorSlotDuplicateId };
      valid = false;
      continue;
    }
    seenIds.add(slot.id);
    const slotErr = validateSlot(slot, t);
    errors[slot.id] = slotErr;
    if (Object.values(slotErr).some((v) => v)) valid = false;
  }

  let totalError: string | null = null;
  if (slots.length > 0) {
    const totalCap = slots.reduce((acc, s) => acc + (Number(s.capacity) || 0), 0);
    if (totalCap > maxPlayers) {
      totalError = create.errorSlotsExceedMaxPlayers
        .replace("{total}", String(totalCap))
        .replace("{max}", String(maxPlayers));
      valid = false;
    }
  }
  return { errors, totalError, valid };
}

/**
 * Uppercase + strip Vietnamese diacritics so the account name matches
 * the format banks print on cards. Called from Step2Payment onBlur.
 */
export function normalizeAccountName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

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

    // Bank-trio. Only required when price_vnd > 0; otherwise null (the
    // free-event branch bypasses these fields entirely).
    case "bank_code": {
      if (form.price_vnd <= 0) return null;
      return String(value).length === 0 ? create.errorRequired : null;
    }
    case "bank_account_number": {
      if (form.price_vnd <= 0) return null;
      const v = String(value).trim();
      if (v.length === 0) return create.errorRequired;
      if (!/^[0-9]{6,20}$/.test(v)) return create.errorAccountNumber;
      return null;
    }
    case "bank_account_name": {
      if (form.price_vnd <= 0) return null;
      const v = String(value).trim();
      if (v.length === 0) return create.errorRequired;
      if (v.length < 3) return create.errorAccountName;
      if (/\d/.test(v)) return create.errorAccountName;
      return null;
    }
    case "requires_prepayment":
      return null;
    case "prepayment_deadline_hours": {
      // Only meaningful for paid events with the toggle on. Otherwise
      // any value is fine (the column has a DEFAULT 12 backstop).
      if (form.price_vnd <= 0 || !form.requires_prepayment) return null;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 168) {
        return create.errorPrepaymentDeadlineRange;
      }
      return null;
    }
    case "repeat_weeks": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 12) {
        return create.errorRepeatWeeksRange;
      }
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
  "repeat_weeks",
];

const STEP2_FIELDS: ReadonlyArray<keyof FormState> = [
  "price_vnd",
  "requires_prepayment",
  "prepayment_deadline_hours",
  "bank_code",
  "bank_account_number",
  "bank_account_name",
];

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
  // Slots roll up into Step-1's valid flag so the "Next" button stays
  // gated until the slot config is consistent.
  const slotResult = validateSlots(form.slots, form.max_players, t);
  if (!slotResult.valid) valid = false;
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
