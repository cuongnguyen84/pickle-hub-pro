// ============================================================================
// What a moderation decision needs before the server will take it.
// ----------------------------------------------------------------------------
// The rules are in Postgres — product_decide() refuses a decision without its
// note, and product_moderation_targets_check() refuses a target that names
// somebody else's variant. This file exists so the SCREEN can say why the
// button is disabled instead of letting a moderator write three paragraphs and
// then handing them a 22023.
//
// It is a pure function on purpose: the branch that decides whether "Gửi
// quyết định" is clickable is worth a test, and a test that has to mount a
// page to reach it will not be written.
// ============================================================================

import type { EditSection } from "./submitProblems";
import { EDIT_SECTIONS, SECTION_LABEL } from "./submitProblems";

/** The five decisions plus the Q5 reopen. Mirrors product_decide's allowlist. */
export const DECISIONS = [
  "approve",
  "request_changes",
  "reject",
  "suspend",
  "unpublish",
  "reopen",
] as const;

export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABEL: Record<Decision, string> = {
  approve: "Duyệt",
  request_changes: "Yêu cầu sửa",
  reject: "Từ chối",
  suspend: "Gỡ khỏi sàn",
  unpublish: "Ẩn khỏi sàn",
  reopen: "Mở lại để sửa",
};

/**
 * What actually happens after the click, in the moderator's language.
 *
 * Written per decision rather than as one generic sentence, because the three
 * things that differ — whether the product stays visible, whether the photos
 * are revoked, and what the seller can do next — are exactly what a moderator
 * needs to know before choosing.
 */
export const DECISION_CONSEQUENCE: Record<Decision, string> = {
  approve:
    "Sản phẩm được duyệt. Ảnh công khai được xếp hàng để tải lên — sản phẩm chỉ thật sự " +
    "hiện với người mua sau khi ảnh lên xong, nên đừng bất ngờ nếu chưa thấy ngay.",
  request_changes:
    "Sản phẩm về trạng thái “cần sửa”. Người bán đọc được lời nhắn của anh và bấm thẳng " +
    "tới đúng chỗ anh đã chọn. Sản phẩm KHÔNG hiển thị công khai.",
  reject:
    "Sản phẩm bị từ chối và không hiển thị công khai. Ảnh công khai (nếu có) bị thu hồi. " +
    "Người bán đọc được lý do; ghi chú nội bộ thì không.",
  suspend:
    "Sản phẩm bị gỡ khỏi sàn NGAY. Người mua không còn thấy, ảnh công khai bị thu hồi. " +
    "Người bán KHÔNG tự bán lại được — phải anh mở lại, họ sửa, rồi anh duyệt lần nữa.",
  unpublish:
    "Sản phẩm bị ẩn khỏi sàn nhưng vẫn ở trạng thái đã duyệt. Ảnh công khai bị thu hồi.",
  reopen:
    "Người bán được sửa lại. Sản phẩm về “cần sửa” và VẪN KHÔNG hiển thị công khai; " +
    "muốn bán lại thì phải gửi duyệt và được duyệt lần nữa.",
};

/** Decisions that must carry a seller-visible note — everything but approve. */
export const NEEDS_APPLICANT_NOTE: readonly Decision[] = DECISIONS.filter((d) => d !== "approve");

/** Decisions that must carry at least one structured target. */
export const NEEDS_TARGETS: readonly Decision[] = ["request_changes", "reopen"];

/**
 * A place in the seller's editor. `variantId`/`mediaId` name a row; there is
 * no index, ever — a position points at a different photo the moment the
 * seller reorders them, and the server refuses one anyway.
 */
export interface ModerationTarget {
  section: EditSection;
  field?: string;
  variant_id?: string;
  media_id?: string;
}

export interface DecisionDraft {
  decision: Decision | null;
  applicantNote: string;
  internalNote: string;
  targets: ModerationTarget[];
  confirmed: boolean;
}

export const emptyDraft = (): DecisionDraft => ({
  decision: null,
  applicantNote: "",
  internalNote: "",
  targets: [],
  confirmed: false,
});

/**
 * Why the submit button is disabled, or null when it is not.
 *
 * One string, because a list of complaints on a form this small is noise. The
 * order is the order a moderator fills the form in.
 */
export function decisionBlocker(
  draft: DecisionDraft,
  allowed: readonly string[],
): string | null {
  if (!draft.decision) return "Chọn một quyết định.";
  if (!allowed.includes(draft.decision)) {
    return "Sản phẩm đã đổi trạng thái. Tải lại để xem những việc còn làm được.";
  }
  if (NEEDS_TARGETS.includes(draft.decision) && draft.targets.length === 0) {
    return "Chọn ít nhất một chỗ cần sửa — người bán sẽ bấm thẳng tới đó.";
  }
  if (NEEDS_APPLICANT_NOTE.includes(draft.decision) && draft.applicantNote.trim() === "") {
    return "Viết lời nhắn cho người bán — đây là thứ duy nhất họ nhận được.";
  }
  if (!draft.confirmed) return "Xác nhận anh đã xem lại trước khi gửi.";
  return null;
}

/** The `_requested_targets` payload. Empty for decisions that take none. */
export function targetsPayload(draft: DecisionDraft): ModerationTarget[] {
  return draft.decision && NEEDS_TARGETS.includes(draft.decision) ? draft.targets : [];
}

const targetKey = (t: ModerationTarget) =>
  `${t.section}|${t.field ?? ""}|${t.variant_id ?? ""}|${t.media_id ?? ""}`;

/** Toggle a target in or out. Identity is the whole tuple, not the section. */
export function toggleTarget(targets: ModerationTarget[], t: ModerationTarget): ModerationTarget[] {
  const key = targetKey(t);
  const without = targets.filter((x) => targetKey(x) !== key);
  return without.length === targets.length ? [...targets, t] : without;
}

export const isTargetPicked = (targets: ModerationTarget[], t: ModerationTarget) =>
  targets.some((x) => targetKey(x) === targetKey(t));

/** How a picked target reads back to the moderator. */
export function targetLabel(t: ModerationTarget, variantName?: string, mediaLabel?: string): string {
  const base = SECTION_LABEL[t.section] ?? t.section;
  if (t.variant_id) return `${base} — ${variantName ?? "phiên bản đã chọn"}`;
  if (t.media_id) return `${base} — ${mediaLabel ?? "ảnh đã chọn"}`;
  if (t.field) return `${base} (${t.field})`;
  return base;
}

/** Section-only targets, for the checkbox list. */
export const SECTION_TARGETS: ModerationTarget[] = EDIT_SECTIONS.map((section) => ({ section }));

/** Server guard failures, in the moderator's words. */
export function moderationErrorMessage(err: unknown): string {
  const message = (err as { message?: string })?.message ?? "";
  if (/admin required|insufficient_privilege|42501/.test(message)) {
    return "Phiên đăng nhập chưa đủ quyền. Đăng nhập lại bằng 2FA rồi thử lại.";
  }
  if (/PT409|đã đổi từ lúc mở duyệt/.test(message)) {
    return "Người bán đã sửa sản phẩm từ lúc anh mở màn này. Tải lại để đọc bản mới — quyết định cũ đang nói về nội dung khác.";
  }
  if (/chỉ duyệt được sản phẩm đang chờ|trạng thái/.test(message)) {
    return "Sản phẩm đã được xử lý ở nơi khác. Tải lại để xem trạng thái mới.";
  }
  if (/lời nhắn cho người bán/.test(message)) {
    return "Cần lời nhắn cho người bán — đây là thứ duy nhất họ nhận được.";
  }
  if (/chỗ cần sửa/.test(message)) {
    return "Cần chọn ít nhất một chỗ cần sửa, và phải gọi tên chứ không dùng vị trí.";
  }
  if (/không thuộc sản phẩm này/.test(message)) {
    return "Một chỗ cần sửa đang trỏ sang sản phẩm khác. Bỏ chọn rồi chọn lại.";
  }
  return "Chưa gửi được quyết định. Những gì anh vừa gõ vẫn còn — người bán CHƯA nhận được gì.";
}
