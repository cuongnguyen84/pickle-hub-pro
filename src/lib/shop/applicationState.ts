// ============================================================================
// Seller application — state machine + field validation.
// ----------------------------------------------------------------------------
// Pure, per architecture-boundaries.md §1: anything with a branch worth testing
// is a function in lib/ with a test, not a condition buried in a component.
//
// The rules here are the CLIENT half of a pair. The authority is
// `shop_application_submit()` in migration 20260811090000, which re-checks
// every one of them — the client copy exists to produce a message next to the
// right field, never to decide whether a row may move.
// ============================================================================

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_changes"
  | "approved"
  | "rejected"
  | "withdrawn";

export type ApplicationAction = "save" | "submit" | "withdraw" | "decide";

/** Statuses the applicant may still edit. */
export const EDITABLE: readonly ApplicationStatus[] = ["draft", "needs_changes"];

/** Statuses that are over — a new application is allowed from here. */
export const TERMINAL: readonly ApplicationStatus[] = ["approved", "rejected", "withdrawn"];

/** Statuses a moderator may act on. */
export const DECIDABLE: readonly ApplicationStatus[] = ["submitted", "under_review", "needs_changes"];

export const canEdit = (s: ApplicationStatus): boolean => EDITABLE.includes(s);
export const isTerminal = (s: ApplicationStatus): boolean => TERMINAL.includes(s);
export const canDecide = (s: ApplicationStatus): boolean => DECIDABLE.includes(s);

/** Mirrors the transitions the RPCs actually allow. */
export const canPerform = (s: ApplicationStatus, action: ApplicationAction): boolean => {
  switch (action) {
    case "save":
      return canEdit(s);
    case "submit":
      return canEdit(s);
    case "withdraw":
      return !isTerminal(s);
    case "decide":
      return canDecide(s);
    default:
      return false;
  }
};

// ─── Field validation ───────────────────────────────────────────────────────

export interface ApplicationDraft {
  seller_type?: string | null;
  full_name?: string | null;
  phone?: string | null;
  shop_name?: string | null;
  shop_intro?: string | null;
  pickup_address?: string | null;
  city?: string | null;
}

export interface FieldRule {
  /** Step index in the wizard — drives the stepper summary and deep links. */
  step: number;
  /** DOM id, so an error can focus the exact input the moderator meant. */
  field: string;
  label: string;
  message: string;
  ok: (d: ApplicationDraft) => boolean;
}

const text = (v: string | null | undefined) => (v ?? "").trim();

export const APPLICATION_RULES: readonly FieldRule[] = [
  {
    step: 0,
    field: "f-type",
    label: "Loại người bán",
    message: "Chọn một loại người bán để đi tiếp.",
    ok: (d) => ["ca-nhan", "ho-kinh-doanh", "cong-ty"].includes(text(d.seller_type)),
  },
  {
    step: 1,
    field: "f-name",
    label: "Họ tên theo giấy tờ",
    message: "Chưa điền họ tên.",
    ok: (d) => text(d.full_name).length >= 2,
  },
  {
    step: 1,
    field: "f-phone",
    label: "Số điện thoại",
    message: "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0.",
    // Same expression as the CHECK constraint on shop_applications.phone.
    ok: (d) => /^0\d{9}$/.test(text(d.phone).replace(/\s/g, "")),
  },
  {
    step: 2,
    field: "f-shop",
    label: "Tên shop",
    message: "Tên shop cần ít nhất 3 ký tự.",
    ok: (d) => text(d.shop_name).length >= 3,
  },
  {
    step: 3,
    field: "f-city",
    label: "Tỉnh / thành phố",
    message: "Chưa điền tỉnh/thành gửi hàng.",
    ok: (d) => text(d.city).length >= 2,
  },
];

/** Fields a moderator can point at. Superset of the required ones. */
export const REQUEST_TARGETS: readonly { step: number; field: string; label: string }[] = [
  ...APPLICATION_RULES.map(({ step, field, label }) => ({ step, field, label })),
  { step: 2, field: "f-desc", label: "Giới thiệu shop" },
  { step: 3, field: "f-addr", label: "Địa chỉ gửi hàng" },
];

export const failingRules = (d: ApplicationDraft): FieldRule[] =>
  APPLICATION_RULES.filter((r) => !r.ok(d));

export const isSubmittable = (d: ApplicationDraft): boolean => failingRules(d).length === 0;

/** Steps carrying at least one failure — the stepper summary. */
export const failingSteps = (d: ApplicationDraft): number[] =>
  [...new Set(failingRules(d).map((r) => r.step))].sort((a, b) => a - b);

export const targetByField = (field: string) => REQUEST_TARGETS.find((t) => t.field === field);

/** Deep link a moderator's request turns into for the applicant. */
export const applicationDeepLink = (field: string): string => {
  const t = targetByField(field);
  return t ? `/seller/application?step=${t.step}&focus=${t.field}` : "/seller/application";
};

// ─── Decision rules (moderator side) ────────────────────────────────────────

export type Decision = "request-changes" | "approve" | "reject";

export interface DecisionInput {
  decision: Decision | "";
  applicantNote: string;
  requestedFields: string[];
}

/**
 * Why a decision cannot be submitted yet, or null when it can.
 * Mirrors the guards in shop_application_decide().
 */
export const decisionBlocker = (input: DecisionInput): string | null => {
  if (!input.decision) return "Chọn một quyết định.";
  if (input.decision !== "approve" && input.applicantNote.trim().length < 10) {
    return "Viết rõ cần sửa gì — người nộp chỉ nhận đúng đoạn này, không có gì khác.";
  }
  if (input.decision === "request-changes" && input.requestedFields.length === 0) {
    return "Tick ít nhất một ô cần sửa. “Sửa lại hồ sơ” chung chung khiến người nộp phải đọc lại cả 6 bước.";
  }
  return null;
};
