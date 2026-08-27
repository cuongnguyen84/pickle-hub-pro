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
export const PPA_WPR_FETCHED_AT = "2026-08-27";

export const PPA_WPR_SOURCE_URL = "https://www.ppatour.com/rankings/";

export const PPA_WPR_MEN: PpaRankingEntry[] = [
  { rank: 1, name: "Ben Johns", points: 19287.5, eventsPlayed: 38, country: "United States", countryCode: "us" },
  { rank: 2, name: "Gabriel Tardio", points: 13476.25, eventsPlayed: 41, country: "Bolivia", countryCode: "bo" },
  { rank: 3, name: "Christian Alshon", points: 12052.5, eventsPlayed: 50, country: "United States", countryCode: "us" },
  { rank: 4, name: "Hayden Patriquin", points: 11437.5, eventsPlayed: 30, country: "United States", countryCode: "us" },
  { rank: 5, name: "Federico Staksrud", points: 10877.5, eventsPlayed: 60, country: "Argentina", countryCode: "ar" },
  { rank: 6, name: "Andrei Daescu", points: 10430, eventsPlayed: 35, country: "Romania", countryCode: "ro" },
  { rank: 7, name: "JW Johnson", points: 10380.625, eventsPlayed: 43, country: "United States", countryCode: "us" },
  { rank: 8, name: "CJ Klinger", points: 6415, eventsPlayed: 30, country: "United States", countryCode: "us" },
  { rank: 9, name: "Eric Oncins", points: 5861.25, eventsPlayed: 55, country: "Brazil", countryCode: "br" },
  { rank: 10, name: "Connor Garnett", points: 4487.5, eventsPlayed: 56, country: "United States", countryCode: "us" },
  { rank: 11, name: "Noe Khlif", points: 4303.75, eventsPlayed: 50, country: "France", countryCode: "fr" },
  { rank: 12, name: "Dylan Frazier", points: 4028.75, eventsPlayed: 54, country: "United States", countryCode: "us" },
  { rank: 13, name: "Tama Shimabukuro", points: 3838.125, eventsPlayed: 67, country: "United States", countryCode: "us" },
  { rank: 14, name: "Tyson McGuffin", points: 3648.75, eventsPlayed: 43, country: "United States", countryCode: "us" },
  { rank: 15, name: "Hunter Johnson", points: 3475, eventsPlayed: 45, country: "United States", countryCode: "us" },
  { rank: 16, name: "Hong Kit Wong", points: 3343.75, eventsPlayed: 48, country: "Hong Kong S.A.R.", countryCode: "hk" },
  { rank: 17, name: "Christopher Haworth", points: 3180.625, eventsPlayed: 50, country: "United States", countryCode: "us" },
  { rank: 18, name: "Armaan Bhatia", points: 2924.375, eventsPlayed: 40, country: "India", countryCode: "in" },
  { rank: 19, name: "Eunggwon KIM", points: 2917.5, eventsPlayed: 41, country: "South Korea", countryCode: "kr" },
  { rank: 20, name: "Riley Newman", points: 2847.5, eventsPlayed: 31, country: "United States", countryCode: "us" },
  { rank: 21, name: "Len Yang", points: 2800.625, eventsPlayed: 32, country: "United States", countryCode: "us" },
  { rank: 22, name: "Jaume Martinez Vich", points: 2765, eventsPlayed: 44, country: "Spain", countryCode: "es" },
  { rank: 23, name: "Jonathan Truong", points: 2754.375, eventsPlayed: 44, country: "United States", countryCode: "us" },
  { rank: 24, name: "Roscoe Bellamy", points: 2733.125, eventsPlayed: 44, country: "United States", countryCode: "us" },
  { rank: 25, name: "Augustus Ge", points: 2520.625, eventsPlayed: 48, country: "United States", countryCode: "us" },
];

export const PPA_WPR_WOMEN: PpaRankingEntry[] = [
  { rank: 1, name: "Anna Leigh Waters", points: 21905, eventsPlayed: 43, country: "United States", countryCode: "us" },
  { rank: 2, name: "Anna Bright", points: 16730, eventsPlayed: 34, country: "United States", countryCode: "us" },
  { rank: 3, name: "Jorja Johnson", points: 11796.25, eventsPlayed: 42, country: "United States", countryCode: "us" },
  { rank: 4, name: "Tyra Hurricane Black", points: 10587.5, eventsPlayed: 38, country: "United States", countryCode: "us" },
  { rank: 5, name: "Catherine Parenteau", points: 8930, eventsPlayed: 48, country: "Canada", countryCode: "ca" },
  { rank: 6, name: "Parris Todd", points: 8570, eventsPlayed: 30, country: "United States", countryCode: "us" },
  { rank: 7, name: "Rachel Rohrabacher", points: 7630, eventsPlayed: 31, country: "United States", countryCode: "us" },
  { rank: 8, name: "Kate Fahey", points: 6607.5, eventsPlayed: 46, country: "United States", countryCode: "us" },
  { rank: 9, name: "Tina Pisnik", points: 5596.25, eventsPlayed: 36, country: "Slovenia", countryCode: "si" },
  { rank: 10, name: "Kaitlyn Christian", points: 5563.75, eventsPlayed: 55, country: "United States", countryCode: "us" },
  { rank: 11, name: "Chao Yi Wang", points: 5160, eventsPlayed: 63, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 12, name: "Jade Kawamoto", points: 5002.5, eventsPlayed: 17, country: "United States", countryCode: "us" },
  { rank: 13, name: "Lacy Schneemann", points: 4223.125, eventsPlayed: 43, country: "United States", countryCode: "us" },
  { rank: 14, name: "Alix Truong", points: 4107.5, eventsPlayed: 41, country: "United States", countryCode: "us" },
  { rank: 15, name: "Jessie Irvine", points: 3916.25, eventsPlayed: 51, country: "United States", countryCode: "us" },
  { rank: 16, name: "Lea Jansen", points: 3679.375, eventsPlayed: 54, country: "United States", countryCode: "us" },
  { rank: 17, name: "Meghan Dizon", points: 3535, eventsPlayed: 31, country: "United States", countryCode: "us" },
  { rank: 18, name: "Jackie Kawamoto", points: 3450, eventsPlayed: 14, country: "United States", countryCode: "us" },
  { rank: 19, name: "Brooke Buckner", points: 3291.25, eventsPlayed: 49, country: "United States", countryCode: "us" },
  { rank: 20, name: "Sahra Dennehy", points: 3283.75, eventsPlayed: 39, country: "Australia", countryCode: "au" },
  { rank: 21, name: "Ting Chieh Wei", points: 3171.25, eventsPlayed: 53, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 22, name: "Yufei Long", points: 2910, eventsPlayed: 36, country: "China", countryCode: "cn" },
  { rank: 23, name: "Mari Humberg", points: 2892.625, eventsPlayed: 49, country: "Brazil", countryCode: "br" },
  { rank: 24, name: "Danni-Elle Townsend", points: 2837.5, eventsPlayed: 30, country: "Australia", countryCode: "au" },
  { rank: 25, name: "Callie Smith", points: 2593.75, eventsPlayed: 35, country: "United States", countryCode: "us" },
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
  { board: "women", rank: 14, name: "Alix Truong", countryCode: "us", points: 4107.5 },
  { board: "men", rank: 23, name: "Jonathan Truong", countryCode: "us", points: 2754.375 },
  { board: "men", rank: 28, name: "Hien Truong", countryCode: "vn", points: 2216.25 },
  { board: "men", rank: 45, name: "Luc Pham", countryCode: "us", points: 1588.625 },
  { board: "women", rank: 52, name: "Sophia Nhi Huynh", countryCode: "vn", points: 1231.25 },
  { board: "women", rank: 57, name: "HO Tam", countryCode: "vn", points: 1171.25 },
  { board: "men", rank: 63, name: "Hoang Nam Ly", countryCode: "vn", points: 1077.5 },
  { board: "women", rank: 74, name: "Sophia Phuong Anh Tran", countryCode: "vn", points: 882.5 },
  { board: "men", rank: 95, name: "Phuc Huynh", countryCode: "vn", points: 575 },
  { board: "men", rank: 108, name: "Giang Trinh", countryCode: "vn", points: 517.5 },
  { board: "women", rank: 134, name: "Ngoc Si", countryCode: "vn", points: 280 },
  { board: "men", rank: 177, name: "Lê Xuân Đức", countryCode: "vn", points: 178.75 },
  { board: "men", rank: 193, name: "Nguyen Hung Anh", countryCode: "vn", points: 145 },
  { board: "men", rank: 208, name: "Khuong Huynh", countryCode: "vn", points: 125 },
  { board: "men", rank: 209, name: "Tiến Đạt Lê", countryCode: "vn", points: 125 },
  { board: "men", rank: 210, name: "Nguyen Thang", countryCode: "vn", points: 125 },
  { board: "men", rank: 215, name: "Andrew Anh Pham", countryCode: "vn", points: 120 },
  { board: "women", rank: 217, name: "Jolie Lam", countryCode: "vn", points: 75 },
  { board: "women", rank: 220, name: "LOI TRAN", countryCode: "vn", points: 75 },
  { board: "men", rank: 224, name: "Hoàng Nguyễn Anh", countryCode: "vn", points: 105 },
  { board: "men", rank: 231, name: "HO Hoan", countryCode: "vn", points: 100 },
  { board: "men", rank: 256, name: "Ngoc Trieu Tran", countryCode: "vn", points: 75 },
  { board: "women", rank: 264, name: "Tran Tue Ngoc", countryCode: "vn", points: 50 },
  { board: "men", rank: 267, name: "Pham XuanVu", countryCode: "vn", points: 66.25 },
  { board: "women", rank: 280, name: "Binh Phan", countryCode: "vn", points: 42.5 },
  { board: "men", rank: 311, name: "Anh Pham", countryCode: "vn", points: 50 },
  { board: "men", rank: 315, name: "Carlos Rubio", countryCode: "vn", points: 50 },
  { board: "men", rank: 342, name: "Minh Nhật", countryCode: "vn", points: 42.5 },
  { board: "men", rank: 344, name: "Ngo Dang", countryCode: "vn", points: 41.875 },
  { board: "women", rank: 345, name: "Phan Quynh", countryCode: "vn", points: 25 },
  { board: "women", rank: 360, name: "Thilehang Tra", countryCode: "vn", points: 25 },
  { board: "women", rank: 361, name: "Trang Tran", countryCode: "vn", points: 25 },
  { board: "women", rank: 362, name: "Thuy Pham", countryCode: "vn", points: 25 },
  { board: "men", rank: 364, name: "Khoa Vo", countryCode: "vn", points: 37.5 },
  { board: "women", rank: 369, name: "Bich Hua", countryCode: "vn", points: 25 },
  { board: "men", rank: 387, name: "Nguyen Tien", countryCode: "vn", points: 31.25 },
  { board: "men", rank: 439, name: "Minh Le", countryCode: "vn", points: 25 },
  { board: "men", rank: 446, name: "Nguyen Huy", countryCode: "vn", points: 25 },
  { board: "men", rank: 447, name: "Nguyễn việt hoàng", countryCode: "vn", points: 25 },
  { board: "men", rank: 454, name: "Nguyễn Hoàng", countryCode: "vn", points: 22.5 },
  { board: "men", rank: 562, name: "Phong Tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 563, name: "Hoang Bao Long", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 564, name: "Minh Nguyễn Hoàng", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 568, name: "Nam Vu", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 569, name: "Tran Tuan Minh", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 585, name: "Quang Tran", countryCode: "vn", points: 12.5 },
];
