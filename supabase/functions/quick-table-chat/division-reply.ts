// Ca log 117 (11/11/2026): dán "Trình A" + tên, "TRÌNH B" + tên → model đặt đúng
// unmet nhiều hạng nhưng lại trả câu ghép cặp chung cho cả 16 người, nuốt mất
// luật mỗi hạng một giải. fill + unmet nhiều hạng → luôn nói luật đó, bỏ câu gộp.
const MANY = /nhiều (hạng|trình)|nhieu (hang|trinh)|(multiple|several) (divisions|levels)/i;

/** Câu thay cho reply của model khi intent fill + unmet nhiều hạng; null = giữ reply của model. */
export function divisionReply(intent: string, unmet: string | null, lang: "vi" | "en"): string | null {
  if (intent !== "fill" || !unmet || !MANY.test(unmet)) return null;
  const rest = unmet.split(/\s*;\s*/).filter((u) => u && !MANY.test(u));
  return lang === "vi"
    ? `Mỗi hạng một giải riêng: mình làm hạng đầu trước với danh sách của hạng đó, tạo xong sẽ mời tạo tiếp hạng sau với thông tin chung.${rest.length ? ` Chưa hỗ trợ thêm: ${rest.join("; ")}.` : ""}`
    : `One tournament per division: I'll do the first division with its own list, then offer the next one with the shared details.${rest.length ? ` Also not supported yet: ${rest.join("; ")}.` : ""}`;
}
