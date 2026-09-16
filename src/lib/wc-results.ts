// Bài kết quả Pickleball World Cup 2026 Đà Nẵng — giải đã xong nhưng bài vẫn là
// trang kết quả chính, nên link này không tự hết hạn như WorldCupLiveBoard.
// Cả hai slug đều là bản dịch của nhau (hreflang en/vi), đừng đổi lẻ một bên.
export const wcResultsPath = (language: "en" | "vi"): string =>
  language === "vi"
    ? "/vi/blog/ket-qua-pickleball-world-cup-2026-da-nang"
    : "/blog/pickleball-world-cup-2026-da-nang-results";

export const wcResultsLabel = (language: "en" | "vi"): string =>
  language === "vi" ? "Kết quả World Cup 2026" : "World Cup 2026 results";
