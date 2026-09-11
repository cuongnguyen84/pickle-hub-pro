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
  eventsPlayed: number;
  country: string;
  /** ISO 3166-1 alpha-2, lowercase — nguồn trả sẵn. */
  countryCode: string;
  isTied?: boolean;
}

/** Ngày ThePickleHub lấy số liệu từ trang nguồn (không phải ngày PPA cập nhật). */
export const PPA_WPR_FETCHED_AT = "2026-09-11";

export const PPA_WPR_SOURCE_URL = "https://www.ppatour.com/rankings/";

export const PPA_WPR_MEN: PpaRankingEntry[] = [
  { rank: 1, name: "Ben Johns", points: 19802.5, eventsPlayed: 39, country: "United States", countryCode: "us" },
  { rank: 2, name: "Gabriel Tardio", points: 14031.25, eventsPlayed: 40, country: "Bolivia", countryCode: "bo" },
  { rank: 3, name: "Christian Alshon", points: 12812.5, eventsPlayed: 51, country: "United States", countryCode: "us" },
  { rank: 4, name: "Hayden Patriquin", points: 12057.5, eventsPlayed: 30, country: "United States", countryCode: "us" },
  { rank: 5, name: "JW Johnson", points: 11500.625, eventsPlayed: 46, country: "United States", countryCode: "us" },
  { rank: 6, name: "Federico Staksrud", points: 11225, eventsPlayed: 60, country: "Argentina", countryCode: "ar" },
  { rank: 7, name: "Andrei Daescu", points: 10900, eventsPlayed: 35, country: "Romania", countryCode: "ro" },
  { rank: 8, name: "CJ Klinger", points: 6480, eventsPlayed: 29, country: "United States", countryCode: "us" },
  { rank: 9, name: "Eric Oncins", points: 5903.75, eventsPlayed: 55, country: "Brazil", countryCode: "br" },
  { rank: 10, name: "Noe Khlif", points: 4468.75, eventsPlayed: 50, country: "France", countryCode: "fr" },
  { rank: 11, name: "Tama Shimabukuro", points: 4328.125, eventsPlayed: 67, country: "United States", countryCode: "us" },
  { rank: 12, name: "Dylan Frazier", points: 4156.25, eventsPlayed: 54, country: "United States", countryCode: "us" },
  { rank: 13, name: "Connor Garnett", points: 4112.5, eventsPlayed: 55, country: "United States", countryCode: "us" },
  { rank: 14, name: "Hunter Johnson", points: 3672.5, eventsPlayed: 45, country: "United States", countryCode: "us" },
  { rank: 15, name: "Tyson McGuffin", points: 3556.25, eventsPlayed: 42, country: "United States", countryCode: "us" },
  { rank: 16, name: "Christopher Haworth", points: 3516.875, eventsPlayed: 50, country: "United States", countryCode: "us" },
  { rank: 17, name: "Hong Kit Wong", points: 3035, eventsPlayed: 43, country: "Hong Kong S.A.R.", countryCode: "hk" },
  { rank: 18, name: "Armaan Bhatia", points: 2973.125, eventsPlayed: 42, country: "India", countryCode: "in" },
  { rank: 19, name: "Riley Newman", points: 2867.5, eventsPlayed: 31, country: "United States", countryCode: "us" },
  { rank: 20, name: "Roscoe Bellamy", points: 2800.625, eventsPlayed: 44, country: "United States", countryCode: "us" },
  { rank: 21, name: "Jaume Martinez Vich", points: 2737.5, eventsPlayed: 43, country: "Spain", countryCode: "es" },
  { rank: 22, name: "Len Yang", points: 2695.625, eventsPlayed: 32, country: "United States", countryCode: "us" },
  { rank: 23, name: "Eunggwon Kim", points: 2577.5, eventsPlayed: 37, country: "South Korea", countryCode: "kr" },
  { rank: 24, name: "Augustus Ge", points: 2565.625, eventsPlayed: 50, country: "United States", countryCode: "us" },
  { rank: 25, name: "Jack Sock", points: 2550.625, eventsPlayed: 37, country: "United States", countryCode: "us" },
];

export const PPA_WPR_WOMEN: PpaRankingEntry[] = [
  { rank: 1, name: "Anna Leigh Waters", points: 22705, eventsPlayed: 44, country: "United States", countryCode: "us" },
  { rank: 2, name: "Anna Bright", points: 17920, eventsPlayed: 34, country: "United States", countryCode: "us" },
  { rank: 3, name: "Jorja Johnson", points: 12586.25, eventsPlayed: 42, country: "United States", countryCode: "us" },
  { rank: 4, name: "Tyra Hurricane Black", points: 10747.5, eventsPlayed: 38, country: "United States", countryCode: "us" },
  { rank: 5, name: "Parris Todd", points: 8810, eventsPlayed: 31, country: "United States", countryCode: "us" },
  { rank: 6, name: "Catherine Parenteau", points: 8790, eventsPlayed: 49, country: "Canada", countryCode: "ca" },
  { rank: 7, name: "Rachel Rohrabacher", points: 8405, eventsPlayed: 33, country: "United States", countryCode: "us" },
  { rank: 8, name: "Kate Fahey", points: 7232.5, eventsPlayed: 46, country: "United States", countryCode: "us" },
  { rank: 9, name: "Tina Pisnik", points: 5740, eventsPlayed: 36, country: "Slovenia", countryCode: "si" },
  { rank: 10, name: "Kaitlyn Christian", points: 5666.25, eventsPlayed: 55, country: "United States", countryCode: "us" },
  { rank: 11, name: "Chao Yi Wang", points: 5160, eventsPlayed: 63, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 12, name: "Jade Kawamoto", points: 5002.5, eventsPlayed: 17, country: "United States", countryCode: "us" },
  { rank: 13, name: "Lacy Schneemann", points: 4290.625, eventsPlayed: 44, country: "United States", countryCode: "us" },
  { rank: 14, name: "Lea Jansen", points: 4111.875, eventsPlayed: 54, country: "United States", countryCode: "us" },
  { rank: 15, name: "Alix Truong", points: 3970, eventsPlayed: 39, country: "United States", countryCode: "us" },
  { rank: 16, name: "Jessie Irvine", points: 3938.75, eventsPlayed: 51, country: "United States", countryCode: "us" },
  { rank: 17, name: "Jackie Kawamoto", points: 3450, eventsPlayed: 14, country: "United States", countryCode: "us" },
  { rank: 18, name: "Brooke Buckner", points: 3412.5, eventsPlayed: 49, country: "United States", countryCode: "us" },
  { rank: 19, name: "Meghan Dizon", points: 3390, eventsPlayed: 30, country: "United States", countryCode: "us" },
  { rank: 20, name: "Sahra Dennehy", points: 3058.75, eventsPlayed: 34, country: "Australia", countryCode: "au" },
  { rank: 21, name: "Mari Humberg", points: 2907.625, eventsPlayed: 50, country: "Brazil", countryCode: "br" },
  { rank: 22, name: "Ting Chieh Wei", points: 2775, eventsPlayed: 48, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 23, name: "Callie Smith", points: 2643.75, eventsPlayed: 35, country: "United States", countryCode: "us" },
  { rank: 24, name: "Milan Rane", points: 2515.625, eventsPlayed: 46, country: "United States", countryCode: "us" },
  { rank: 25, name: "Etta Tuionetoa", points: 2515, eventsPlayed: 23, country: "United States", countryCode: "us" },
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
  { board: "women", rank: 15, name: "Alix Truong", countryCode: "us", points: 3970 },
  { board: "men", rank: 26, name: "Jonathan Truong", countryCode: "us", points: 2485.625 },
  { board: "men", rank: 30, name: "Hien Truong", countryCode: "vn", points: 2121.25 },
  { board: "men", rank: 41, name: "Luc Pham", countryCode: "us", points: 1619.875 },
  { board: "women", rank: 52, name: "Sophia Nhi Huynh", countryCode: "vn", points: 1163.75 },
  { board: "women", rank: 53, name: "Ho Tam", countryCode: "vn", points: 1121.25 },
  { board: "men", rank: 69, name: "Hoang Nam Ly", countryCode: "vn", points: 950 },
  { board: "women", rank: 76, name: "Sophia Phuong Anh Tran", countryCode: "vn", points: 808.5 },
  { board: "men", rank: 119, name: "Giang Trinh", countryCode: "vn", points: 420 },
  { board: "women", rank: 130, name: "NGOC SI", countryCode: "vn", points: 280 },
  { board: "men", rank: 139, name: "Phuc Huynh", countryCode: "vn", points: 315 },
  { board: "men", rank: 189, name: "Nguyen Hung Anh", countryCode: "vn", points: 145 },
  { board: "men", rank: 196, name: "LE Xuan Duc", countryCode: "vn", points: 136.25 },
  { board: "men", rank: 220, name: "HO Hoan", countryCode: "vn", points: 108.1 },
  { board: "men", rank: 225, name: "Hoang Nguyen Anh", countryCode: "vn", points: 105 },
  { board: "men", rank: 233, name: "Khuong Huynh", countryCode: "vn", points: 100 },
  { board: "men", rank: 234, name: "Tiến Đạt Lê", countryCode: "vn", points: 100 },
  { board: "men", rank: 258, name: "Nguyen Thang", countryCode: "vn", points: 75 },
  { board: "women", rank: 266, name: "Jolie Lam", countryCode: "vn", points: 50 },
  { board: "women", rank: 268, name: "Tran Tue Ngoc", countryCode: "vn", points: 50 },
  { board: "women", rank: 270, name: "LOI TRAN", countryCode: "vn", points: 50 },
  { board: "men", rank: 278, name: "Nguyen Huy", countryCode: "vn", points: 63.4 },
  { board: "men", rank: 280, name: "Andrew Anh Pham", countryCode: "vn", points: 62.5 },
  { board: "women", rank: 284, name: "Binh Phan", countryCode: "vn", points: 42.5 },
  { board: "men", rank: 286, name: "Pham XuanVu", countryCode: "vn", points: 58.75 },
  { board: "men", rank: 310, name: "Carlos Rubio", countryCode: "vn", points: 50 },
  { board: "men", rank: 315, name: "Ngoc Trieu Tran", countryCode: "vn", points: 50 },
  { board: "men", rank: 316, name: "Anh Pham", countryCode: "vn", points: 50 },
  { board: "men", rank: 342, name: "Hai Dang Ngo", countryCode: "vn", points: 41.875 },
  { board: "women", rank: 347, name: "Bich Hua", countryCode: "vn", points: 25 },
  { board: "men", rank: 355, name: "Nhật Minh T", countryCode: "vn", points: 38.4 },
  { board: "women", rank: 358, name: "Phan Quynh", countryCode: "vn", points: 25 },
  { board: "women", rank: 359, name: "Thilehang Tra", countryCode: "vn", points: 25 },
  { board: "men", rank: 362, name: "Khoa Vo", countryCode: "vn", points: 37.5 },
  { board: "women", rank: 369, name: "Thuy Pham", countryCode: "vn", points: 25 },
  { board: "men", rank: 442, name: "Nguyễn Hoàng", countryCode: "vn", points: 22.5 },
  { board: "men", rank: 486, name: "Minh Nhật", countryCode: "vn", points: 17.5 },
  { board: "men", rank: 502, name: "Nguyen Tien", countryCode: "vn", points: 16.25 },
  { board: "men", rank: 554, name: "Minh Nguyễn Hoàng", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 557, name: "Hoang Bao Long", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 558, name: "quang tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 566, name: "Tran Tuan Minh", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 569, name: "Nam Vu", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 578, name: "Phong Tran", countryCode: "vn", points: 12.5 },
];
