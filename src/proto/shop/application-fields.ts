// ============================================================================
// The one list of things an admin can ask an applicant to fix.
// ----------------------------------------------------------------------------
// Shared by three screens so they cannot drift apart:
//   A03 — moderator ticks what needs redoing
//   S03 — applicant sees the same items, with a deep link each
//   S02 — the form focuses the field the link points at
//
// "Sửa lại hồ sơ" with no target makes the applicant re-read six steps looking
// for the problem. A checkbox plus a link is the difference between a
// resubmission tomorrow and one next week.
// ============================================================================

export interface RequestTarget {
  /** Step index in APPLICATION_STEPS. */
  step: number;
  /** DOM id of the field on that step, so a deep link can focus it. */
  field: string;
  label: string;
}

export const REQUEST_TARGETS: RequestTarget[] = [
  { step: 0, field: "f-type", label: "Loại người bán" },
  { step: 1, field: "f-name", label: "Họ tên theo giấy tờ" },
  { step: 1, field: "f-phone", label: "Số điện thoại" },
  { step: 2, field: "f-shop", label: "Tên shop" },
  { step: 2, field: "f-desc", label: "Giới thiệu shop" },
  { step: 3, field: "f-addr", label: "Địa chỉ gửi hàng" },
  { step: 3, field: "f-city", label: "Tỉnh / thành phố" },
  { step: 4, field: "f-doc", label: "Ảnh giấy phép kinh doanh" },
];

export const targetByField = (field: string): RequestTarget | undefined =>
  REQUEST_TARGETS.find((t) => t.field === field);

/** Deep link straight to the step with the field focused. */
export const applicationDeepLink = (t: RequestTarget): string =>
  `/proto/shop/seller/application?step=${t.step}&focus=${t.field}`;
