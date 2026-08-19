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
export const PPA_WPR_FETCHED_AT = "2026-08-06";

export const PPA_WPR_SOURCE_URL = "https://www.ppatour.com/rankings/";

export const PPA_WPR_MEN: PpaRankingEntry[] = [
  { rank: 1, name: "Ben Johns", points: 19295, eventsPlayed: 41, country: "United States", countryCode: "us" },
  { rank: 2, name: "Gabriel Tardio", points: 13480, eventsPlayed: 44, country: "Bolivia", countryCode: "bo" },
  { rank: 3, name: "Christian Alshon", points: 12212.5, eventsPlayed: 52, country: "United States", countryCode: "us" },
  { rank: 4, name: "Hayden Patriquin", points: 11607.5, eventsPlayed: 32, country: "United States", countryCode: "us" },
  { rank: 5, name: "Federico Staksrud", points: 10895, eventsPlayed: 63, country: "Argentina", countryCode: "ar" },
  { rank: 6, name: "JW Johnson", points: 10760.625, eventsPlayed: 45, country: "United States", countryCode: "us" },
  { rank: 7, name: "Andrei Daescu", points: 10570, eventsPlayed: 37, country: "Romania", countryCode: "ro" },
  { rank: 8, name: "CJ Klinger", points: 6482.5, eventsPlayed: 32, country: "United States", countryCode: "us" },
  { rank: 9, name: "Eric Oncins", points: 5861.25, eventsPlayed: 58, country: "Brazil", countryCode: "br" },
  { rank: 10, name: "Connor Garnett", points: 4547.5, eventsPlayed: 59, country: "United States", countryCode: "us" },
  { rank: 11, name: "Noe Khlif", points: 4407.5, eventsPlayed: 53, country: "France", countryCode: "fr" },
  { rank: 12, name: "Dylan Frazier", points: 4060, eventsPlayed: 57, country: "United States", countryCode: "us" },
  { rank: 13, name: "Tyson McGuffin", points: 3820, eventsPlayed: 46, country: "United States", countryCode: "us" },
  { rank: 14, name: "Hunter Johnson", points: 3590, eventsPlayed: 48, country: "United States", countryCode: "us" },
  { rank: 15, name: "Tama Shimabukuro", points: 3513.125, eventsPlayed: 64, country: "United States", countryCode: "us" },
  { rank: 16, name: "Riley Newman", points: 3182.5, eventsPlayed: 33, country: "United States", countryCode: "us" },
  { rank: 17, name: "Christopher Haworth", points: 3180.625, eventsPlayed: 50, country: "United States", countryCode: "us" },
  { rank: 18, name: "Jaume Martinez Vich", points: 3172.5, eventsPlayed: 47, country: "Spain", countryCode: "es" },
  { rank: 19, name: "Armaan Bhatia", points: 2924.375, eventsPlayed: 40, country: "India", countryCode: "in" },
  { rank: 20, name: "Hong Kit Wong", points: 2780, eventsPlayed: 42, country: "Hong Kong S.A.R.", countryCode: "hk" },
  { rank: 21, name: "Jonathan Truong", points: 2758.125, eventsPlayed: 46, country: "United States", countryCode: "us" },
  { rank: 22, name: "Roscoe Bellamy", points: 2733.125, eventsPlayed: 44, country: "United States", countryCode: "us" },
  { rank: 23, name: "Jack Sock", points: 2574.375, eventsPlayed: 39, country: "United States", countryCode: "us" },
  { rank: 24, name: "Augustus Ge", points: 2537.5, eventsPlayed: 50, country: "United States", countryCode: "us" },
  { rank: 25, name: "Len Yang", points: 2515.625, eventsPlayed: 30, country: "United States", countryCode: "us" },
];

export const PPA_WPR_WOMEN: PpaRankingEntry[] = [
  { rank: 1, name: "Anna Leigh Waters", points: 22255, eventsPlayed: 45, country: "United States", countryCode: "us" },
  { rank: 2, name: "Anna Bright", points: 17065, eventsPlayed: 37, country: "United States", countryCode: "us" },
  { rank: 3, name: "Jorja Johnson", points: 12338.75, eventsPlayed: 45, country: "United States", countryCode: "us" },
  { rank: 4, name: "Tyra Hurricane Black", points: 10687.5, eventsPlayed: 39, country: "United States", countryCode: "us" },
  { rank: 5, name: "Catherine Parenteau", points: 9165, eventsPlayed: 51, country: "Canada", countryCode: "ca" },
  { rank: 6, name: "Parris Todd", points: 9090, eventsPlayed: 33, country: "United States", countryCode: "us" },
  { rank: 7, name: "Rachel Rohrabacher", points: 8025, eventsPlayed: 33, country: "United States", countryCode: "us" },
  { rank: 8, name: "Kate Fahey", points: 6607.5, eventsPlayed: 46, country: "United States", countryCode: "us" },
  { rank: 9, name: "Kaitlyn Christian", points: 5673.75, eventsPlayed: 58, country: "United States", countryCode: "us" },
  { rank: 10, name: "Tina Pisnik", points: 5605, eventsPlayed: 38, country: "Slovenia", countryCode: "si" },
  { rank: 11, name: "Jade Kawamoto", points: 5137.5, eventsPlayed: 19, country: "United States", countryCode: "us" },
  { rank: 12, name: "Chao Yi Wang", points: 5115, eventsPlayed: 63, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 13, name: "Lacy Schneemann", points: 4248.125, eventsPlayed: 45, country: "United States", countryCode: "us" },
  { rank: 14, name: "Alix Truong", points: 4116.25, eventsPlayed: 43, country: "United States", countryCode: "us" },
  { rank: 15, name: "Jessie Irvine", points: 3973.75, eventsPlayed: 54, country: "United States", countryCode: "us" },
  { rank: 16, name: "Lea Jansen", points: 3708.75, eventsPlayed: 57, country: "United States", countryCode: "us" },
  { rank: 17, name: "Jackie Kawamoto", points: 3667.5, eventsPlayed: 16, country: "United States", countryCode: "us" },
  { rank: 18, name: "Meghan Dizon", points: 3652.5, eventsPlayed: 33, country: "United States", countryCode: "us" },
  { rank: 19, name: "Brooke Buckner", points: 3426.25, eventsPlayed: 52, country: "United States", countryCode: "us" },
  { rank: 20, name: "Ting Chieh Wei", points: 3171.25, eventsPlayed: 55, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 21, name: "Sahra Dennehy", points: 2947.5, eventsPlayed: 34, country: "Australia", countryCode: "au" },
  { rank: 22, name: "Mari Humberg", points: 2855.125, eventsPlayed: 49, country: "Brazil", countryCode: "br" },
  { rank: 23, name: "Danni-Elle Townsend", points: 2837.5, eventsPlayed: 30, country: "Australia", countryCode: "au" },
  { rank: 24, name: "Yufei Long", points: 2628.75, eventsPlayed: 35, country: "China", countryCode: "cn" },
  { rank: 25, name: "Etta Tuionetoa", points: 2600, eventsPlayed: 25, country: "United States", countryCode: "us" },
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
  { board: "women", rank: 14, name: "Alix Truong", countryCode: "us", points: 4116.25 },
  { board: "men", rank: 21, name: "Jonathan Truong", countryCode: "us", points: 2758.125 },
  { board: "men", rank: 38, name: "Hien Truong", countryCode: "vn", points: 1653.75 },
  { board: "men", rank: 42, name: "Luc Pham", countryCode: "us", points: 1440.625 },
  { board: "men", rank: 69, name: "Hoang Nam Ly", countryCode: "vn", points: 877.5 },
  { board: "women", rank: 73, name: "HO Tam", countryCode: "vn", points: 823.75 },
  { board: "women", rank: 79, name: "Sophia Nhi Huynh", countryCode: "vn", points: 758.75 },
  { board: "women", rank: 80, name: "Sophia Phuong Anh Tran", countryCode: "vn", points: 750 },
  { board: "men", rank: 93, name: "Phuc Huynh", countryCode: "vn", points: 575 },
  { board: "men", rank: 107, name: "Giang Trinh", countryCode: "vn", points: 517.5 },
  { board: "women", rank: 163, name: "Ngoc Si", countryCode: "vn", points: 150 },
  { board: "men", rank: 195, name: "Lê Xuân Đức", countryCode: "vn", points: 128.75 },
  { board: "men", rank: 198, name: "Nguyen Thang", countryCode: "vn", points: 125 },
  { board: "men", rank: 199, name: "Khuong Huynh", countryCode: "vn", points: 125 },
  { board: "men", rank: 204, name: "Andrew Anh Pham", countryCode: "vn", points: 120 },
  { board: "men", rank: 205, name: "Nguyen Hung Anh", countryCode: "vn", points: 120 },
  { board: "men", rank: 211, name: "Tiến Đạt Lê", countryCode: "vn", points: 112.5 },
  { board: "women", rank: 215, name: "LOI TRAN", countryCode: "vn", points: 75 },
  { board: "women", rank: 216, name: "Jolie Lam", countryCode: "vn", points: 75 },
  { board: "men", rank: 227, name: "Hoàng Nguyễn Anh", countryCode: "vn", points: 92.5 },
  { board: "men", rank: 245, name: "HO Hoan", countryCode: "vn", points: 75 },
  { board: "men", rank: 248, name: "Ngoc Trieu Tran", countryCode: "vn", points: 75 },
  { board: "men", rank: 264, name: "Pham XuanVu", countryCode: "vn", points: 62.5 },
  { board: "men", rank: 299, name: "Carlos Rubio", countryCode: "vn", points: 50 },
  { board: "women", rank: 327, name: "Trang Tran", countryCode: "vn", points: 25 },
  { board: "women", rank: 329, name: "Bich Hua", countryCode: "vn", points: 25 },
  { board: "men", rank: 330, name: "Ngo Dang", countryCode: "vn", points: 41.875 },
  { board: "women", rank: 330, name: "Phan Quynh", countryCode: "vn", points: 25 },
  { board: "men", rank: 341, name: "Khoa Vo", countryCode: "vn", points: 37.5 },
  { board: "women", rank: 343, name: "Thilehang Tra", countryCode: "vn", points: 25 },
  { board: "men", rank: 368, name: "Nguyen Tien", countryCode: "vn", points: 31.25 },
  { board: "men", rank: 404, name: "Minh Le", countryCode: "vn", points: 25 },
  { board: "men", rank: 411, name: "Minh Nhật", countryCode: "vn", points: 25 },
  { board: "men", rank: 426, name: "Nguyen Huy", countryCode: "vn", points: 25 },
  { board: "men", rank: 431, name: "Nguyễn việt hoàng", countryCode: "vn", points: 25 },
  { board: "men", rank: 444, name: "Nguyễn Hoàng", countryCode: "vn", points: 22.5 },
  { board: "men", rank: 546, name: "Nam Vu", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 553, name: "Hoang Bao Long", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 556, name: "Tran Tuan Minh", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 561, name: "Phong Tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 563, name: "Quang Tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 564, name: "Minh Nguyễn Hoàng", countryCode: "vn", points: 12.5 },
];
