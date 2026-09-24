// ============================================================================
// PPA Tour World Pickleball Rankings (WPR) — editorial snapshot.
// ----------------------------------------------------------------------------
// Nguồn: https://www.ppatour.com/rankings/ — trích dẫn biên tập top 25 mỗi
// board, có credit + link về nguồn (KHÔNG mirror toàn bộ bảng: ToS của PPA cấm
// scrape/mirror thương mại khi chưa có văn bản cho phép — xem
// docs/proposals/ppa-rankings-tab/proposal.md mục 6, rủi ro #1).
//
// Cập nhật thủ công: chạy scratchpad parse (proposal §4 Option B) hoặc sửa tay
// theo trang nguồn, rồi đổi PPA_WPR_FETCHED_AT. WPR là điểm tổng hợp rolling
// 52 tuần (đôi 50% + đôi nam nữ 35% + đơn 15%) — nguồn KHÔNG công bố ngày
// cập nhật, nên UI phải nói "số liệu lấy ngày X", không phải "cập nhật ngày X".
// ============================================================================

export type PpaBoardKey = "men" | "women";

export interface PpaRankingEntry {
  rank: number;
  name: string;
  /** Điểm WPR — hiển thị qua Intl.NumberFormat theo locale (12.212,5 cho VI). */
  points: number;
  /**
   * Số giải đã chơi. Nguồn NGỪNG công bố trường này từ lần refresh 2026-09-24
   * (payload chỉ còn rank/name/points/countryCode) → ghi 0. Không nơi nào render
   * nó (web lẫn native); giữ field vì Swift `WprEntry.eventsPlayed: Int` decode
   * bắt buộc. REVIEW: gỡ hẳn cần PR riêng đụng cả apple/ + gen-native-wpr.mjs.
   */
  eventsPlayed: number;
  country: string;
  /** ISO 3166-1 alpha-2, lowercase — nguồn trả sẵn. */
  countryCode: string;
  isTied?: boolean;
}

/** Ngày ThePickleHub lấy số liệu từ trang nguồn (không phải ngày PPA cập nhật). */
export const PPA_WPR_FETCHED_AT = "2026-09-24";

export const PPA_WPR_SOURCE_URL = "https://www.ppatour.com/rankings/";

export const PPA_WPR_MEN: PpaRankingEntry[] = [
  { rank: 1, name: "Ben Johns", points: 17832.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 2, name: "Gabriel Tardio", points: 13291.25, eventsPlayed: 0, country: "Bolivia", countryCode: "bo" },
  { rank: 3, name: "Christian Alshon", points: 11827.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 4, name: "Federico Staksrud", points: 10797.5, eventsPlayed: 0, country: "Argentina", countryCode: "ar" },
  { rank: 5, name: "Hayden Patriquin", points: 10392.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 6, name: "JW Johnson", points: 10092.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 7, name: "Andrei Daescu", points: 9635, eventsPlayed: 0, country: "Romania", countryCode: "ro" },
  { rank: 8, name: "Eric Oncins", points: 5982.5, eventsPlayed: 0, country: "Brazil", countryCode: "br" },
  { rank: 9, name: "CJ Klinger", points: 5786.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 10, name: "Tama Shimabukuro", points: 4740, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 11, name: "Noe Khlif", points: 4708.75, eventsPlayed: 0, country: "France", countryCode: "fr" },
  { rank: 12, name: "Dylan Frazier", points: 3876.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 13, name: "Connor Garnett", points: 3666.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 14, name: "Christopher Haworth", points: 3325, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 15, name: "Tyson McGuffin", points: 3311.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 16, name: "Armaan Bhatia", points: 3310, eventsPlayed: 0, country: "India", countryCode: "in" },
  { rank: 17, name: "Hunter Johnson", points: 3236.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 18, name: "Hong kit Wong", points: 3207.5, eventsPlayed: 0, country: "Hong Kong S.A.R.", countryCode: "hk" },
  { rank: 19, name: "Len Yang", points: 3182.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 20, name: "Roscoe Bellamy", points: 2794.375, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 21, name: "Augustus Ge", points: 2767.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 22, name: "Eunggwon KIM", points: 2762.5, eventsPlayed: 0, country: "South Korea", countryCode: "kr" },
  { rank: 23, name: "Riley Newman", points: 2587.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 24, name: "Jaume Martinez Vich", points: 2425, eventsPlayed: 0, country: "Spain", countryCode: "es" },
  { rank: 25, name: "Yuta Funemizu", points: 2422.5, eventsPlayed: 0, country: "Japan", countryCode: "jp" },
];

export const PPA_WPR_WOMEN: PpaRankingEntry[] = [
  { rank: 1, name: "Anna Leigh Waters", points: 20710, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 2, name: "Anna Bright", points: 15655, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 3, name: "Jorja Johnson", points: 10672.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 4, name: "Tyra Hurricane Black", points: 9530, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 5, name: "Parris Todd", points: 8822.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 6, name: "Rachel Rohrabacher", points: 8740, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 7, name: "Catherine Parenteau", points: 8362.5, eventsPlayed: 0, country: "Canada", countryCode: "ca" },
  { rank: 8, name: "Kate Fahey", points: 6735, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 9, name: "Kaitlyn Christian", points: 5625, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 10, name: "Tina Pisnik", points: 5231.25, eventsPlayed: 0, country: "Slovenia", countryCode: "si" },
  { rank: 11, name: "Chao Yi Wang", points: 5205, eventsPlayed: 0, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 12, name: "Alix Truong", points: 4371.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 13, name: "Jessie Irvine", points: 4227.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 14, name: "Lacy Schneemann", points: 4143.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 15, name: "Jade Kawamoto", points: 3932.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 16, name: "Lea Jansen", points: 3728.125, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 17, name: "Sahra Dennehy", points: 3708.75, eventsPlayed: 0, country: "Australia", countryCode: "au" },
  { rank: 18, name: "Meghan Dizon", points: 3452.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 19, name: "Brooke Buckner", points: 3353.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 20, name: "Ting Chieh Wei", points: 2928.75, eventsPlayed: 0, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 21, name: "Danni-Elle Townsend", points: 2895, eventsPlayed: 0, country: "Australia", countryCode: "au" },
  { rank: 22, name: "Mari Humberg", points: 2775.125, eventsPlayed: 0, country: "Brazil", countryCode: "br" },
  { rank: 23, name: "Yufei Long", points: 2505, eventsPlayed: 0, country: "China", countryCode: "cn" },
  { rank: 24, name: "Lingwei Kong", points: 2444.375, eventsPlayed: 0, country: "China", countryCode: "cn" },
  { rank: 25, name: "Callie Smith", points: 2416.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
];

export const PPA_WPR_BOARDS: Record<PpaBoardKey, PpaRankingEntry[]> = {
  men: PPA_WPR_MEN,
  women: PPA_WPR_WOMEN,
};

// VĐV Việt Nam / gốc Việt trên bảng WPR đầy đủ của nguồn (kể cả ngoài top 25).
//
// QUY TẮC BIÊN TẬP (in trên trang, giữ nguyên khi cập nhật): mọi VĐV mang cờ
// Việt Nam (countryCode "vn") trên bảng WPR tại ngày PPA_WPR_FETCHED_AT, cộng
// 3 VĐV Mỹ gốc Việt nổi bật chọn tay (Alix Truong, Jonathan Truong, Luc Pham).
// Danh sách này là hằng số VIẾT TAY — proposal rankings-dupr-wpr-tabs, risk D2
// điều kiện (4): KHÔNG commit script filter sinh nó; KHÔNG cron/auto-refresh;
// KHÔNG copy headshot. Cập nhật = đối chiếu tay với trang nguồn rồi sửa tại đây
// (mốc refresh: docs/milestones.md WPR-REFRESH).
export interface PpaVietHighlight {
  board: PpaBoardKey;
  rank: number;
  name: string;
  countryCode: string;
  points: number;
}

export const PPA_WPR_VIET_HIGHLIGHTS: PpaVietHighlight[] = [
  { board: "women", rank: 12, name: "Alix Truong", countryCode: "us", points: 4371.25 },
  { board: "men", rank: 27, name: "Jonathan Truong", countryCode: "us", points: 2396.25 },
  { board: "men", rank: 30, name: "Hien Truong", countryCode: "vn", points: 2121.25 },
  { board: "men", rank: 36, name: "Luc Pham", countryCode: "us", points: 1746.75 },
  { board: "women", rank: 50, name: "Sophia Nhi Huynh", countryCode: "vn", points: 1263.75 },
  { board: "women", rank: 54, name: "Ho Tam", countryCode: "vn", points: 1196.25 },
  { board: "women", rank: 69, name: "Sophia Phuong Anh Tran", countryCode: "vn", points: 873.5 },
  { board: "men", rank: 70, name: "Hoang Nam Ly", countryCode: "vn", points: 950 },
  { board: "men", rank: 117, name: "Giang Trinh", countryCode: "vn", points: 420 },
  { board: "women", rank: 130, name: "NGOC SI", countryCode: "vn", points: 280 },
  { board: "men", rank: 144, name: "Phuc Huynh", countryCode: "vn", points: 315 },
  { board: "men", rank: 199, name: "Nguyen Hung Anh", countryCode: "vn", points: 145 },
  { board: "men", rank: 206, name: "LE Xuan Duc", countryCode: "vn", points: 136.25 },
  { board: "men", rank: 229, name: "HO Hoan", countryCode: "vn", points: 108.1 },
  { board: "men", rank: 235, name: "Hoang Nguyen Anh", countryCode: "vn", points: 105 },
  { board: "men", rank: 238, name: "Tiến Đạt Lê", countryCode: "vn", points: 100 },
  { board: "men", rank: 239, name: "Khuong Huynh", countryCode: "vn", points: 100 },
  { board: "women", rank: 263, name: "Tran Tue Ngoc", countryCode: "vn", points: 50 },
  { board: "women", rank: 264, name: "Jolie Lam", countryCode: "vn", points: 50 },
  { board: "women", rank: 265, name: "LOI TRAN", countryCode: "vn", points: 50 },
  { board: "men", rank: 268, name: "Nguyen Thang", countryCode: "vn", points: 75 },
  { board: "men", rank: 274, name: "Hai Dang Ngo", countryCode: "vn", points: 70.625 },
  { board: "women", rank: 280, name: "Binh Phan", countryCode: "vn", points: 42.5 },
  { board: "men", rank: 286, name: "Nguyen Huy", countryCode: "vn", points: 63.4 },
  { board: "men", rank: 287, name: "Andrew Anh Pham", countryCode: "vn", points: 62.5 },
  { board: "men", rank: 292, name: "Pham XuanVu", countryCode: "vn", points: 58.75 },
  { board: "men", rank: 294, name: "Anh Pham", countryCode: "vn", points: 57.5 },
  { board: "men", rank: 312, name: "Carlos Rubio", countryCode: "vn", points: 50 },
  { board: "men", rank: 313, name: "Ngoc Trieu Tran", countryCode: "vn", points: 50 },
  { board: "women", rank: 346, name: "Thuy Pham", countryCode: "vn", points: 25 },
  { board: "women", rank: 353, name: "Thilehang Tra", countryCode: "vn", points: 25 },
  { board: "men", rank: 354, name: "Nhật Minh T", countryCode: "vn", points: 38.4 },
  { board: "women", rank: 355, name: "Phan Quynh", countryCode: "vn", points: 25 },
  { board: "men", rank: 362, name: "Khoa Vo", countryCode: "vn", points: 37.5 },
  { board: "women", rank: 368, name: "Bich Hua", countryCode: "vn", points: 25 },
  { board: "men", rank: 442, name: "Nguyễn Hoàng", countryCode: "vn", points: 22.5 },
  { board: "men", rank: 486, name: "Minh Nhật", countryCode: "vn", points: 17.5 },
  { board: "men", rank: 500, name: "Nguyen Tien", countryCode: "vn", points: 16.25 },
  { board: "men", rank: 501, name: "Nguyen Tien", countryCode: "vn", points: 16.25 },
  { board: "men", rank: 556, name: "Hoang Bao Long", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 562, name: "Phong Tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 568, name: "quang tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 577, name: "Tran Tuan Minh", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 578, name: "Minh Nguyễn Hoàng", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 582, name: "Nam Vu", countryCode: "vn", points: 12.5 },
];
