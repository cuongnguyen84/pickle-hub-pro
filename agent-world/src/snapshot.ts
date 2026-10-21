export type StationStatus = "working" | "paused" | "success" | "error" | "idle";

export interface Station {
  id: string;
  name: string;
  role: string;
  status: StationStatus;
  activity: string;
  order: string;
  detail: string;
  color: string;
  home: [number, number, number];
}

export const TAKEN_AT = "20/10/2026, 20:02 giờ Việt Nam";
export const CYCLE_SECONDS = 3.6;
export const TEAM_LIVE = true;
export const STOPPED_NOTE = "Đội dừng. Hình đứng yên.";

export const CHIEF: Station = {
  id: "chief",
  name: "Điều phối",
  role: "Giao việc cho 8 vai trò",
  status: "working",
  activity: "Đang giao thể thức nhánh tuỳ ý",
  order: "Việc đang giao: nhất bảng vào Series A, nhì vào B, ba vào C. Mỗi hạng một nhánh.",
  detail: "Anh đã duyệt thể thức này. Trần hiện tại là 3 nhánh. Điều phối gọi Giải đấu chốt luật, Phát triển bỏ trần, Nội dung sửa câu chat.",
  color: "#E8B04A",
  home: [0, 0, 3.15],
};

export const AGENTS: Station[] = [
  {
    id: "platform",
    name: "Hệ thống",
    role: "Uptime, job, dịch",
    status: "idle",
    activity: "Đứng ngoài đợt này",
    order: "Không đụng job đăng bài. Đợt này chỉ có nhánh tuỳ ý.",
    detail: "Hệ thống không sửa code giải. Việc news-repair để nguyên.",
    color: "#6C9EFF",
    home: [-5.4, 0, -0.4],
  },
  {
    id: "security",
    name: "Bảo mật",
    role: "Auth, quyền ghi",
    status: "idle",
    activity: "Đứng ngoài đợt này",
    order: "Không đụng auth. Nhánh tuỳ ý không cần quyền mới.",
    detail: "Chat tạo giải vẫn đi qua hàm quick-table-chat sẵn có.",
    color: "#F08A7E",
    home: [-3.6, 0, -1.7],
  },
  {
    id: "commerce",
    name: "Shop",
    role: "Đơn và claim",
    status: "idle",
    activity: "Đứng ngoài đợt này",
    order: "Không đụng đơn và tiền.",
    detail: "Shop không nằm trong thể thức nhánh.",
    color: "#A78BFA",
    home: [-1.2, 0, -2.35],
  },
  {
    id: "sports",
    name: "Giải đấu",
    role: "Lịch và điểm",
    status: "success",
    activity: "Luật nhất → A, nhì → B đã vào code",
    order: "Giữ luật này. Hạng chỉ có 1 đội thì không tách.",
    detail: "8 bảng 4 đội ra Series A B C D, mỗi nhánh 8 đội. Bảng lệch mà hạng cuối chỉ còn 1 đội thì đội đó không vào playoff.",
    color: "#5FD39A",
    home: [1.2, 0, -2.35],
  },
  {
    id: "community",
    name: "Cộng đồng",
    role: "Báo cáo vi phạm",
    status: "idle",
    activity: "Đứng ngoài đợt này",
    order: "Không soạn tin cộng đồng.",
    detail: "Không có báo cáo vi phạm nào gắn với việc này.",
    color: "#5CC8D7",
    home: [3.6, 0, -1.7],
  },
  {
    id: "editorial",
    name: "Nội dung",
    role: "Bài và kết quả giải",
    status: "success",
    activity: "Chat có nút Mỗi hạng một nhánh",
    order: "Câu gõ 'nhất vào A, nhì vào B' cũng nhận, không cần chờ mô hình.",
    detail: "Nút nằm ở bước chọn nhánh. Câu chữ nhận tại máy. Prompt Gemini đã sửa nhưng chưa deploy.",
    color: "#E8B04A",
    home: [5.4, 0, -0.4],
  },
  {
    id: "growth",
    name: "Tăng trưởng",
    role: "GSC, mốc SEO",
    status: "idle",
    activity: "Đứng ngoài đợt này",
    order: "Không đụng mốc SEO trong đợt nhánh tuỳ ý.",
    detail: "Tăng trưởng không sửa thể thức giải.",
    color: "#7CC4D6",
    home: [-2.4, 0, 1.15],
  },
  {
    id: "engineering",
    name: "Phát triển",
    role: "CI và bản sửa",
    status: "success",
    activity: "Database đã nhận tối đa 8 nhánh",
    order: "Migration 20261020140000 đã áp và đã ghi sổ.",
    detail: "Ràng buộc trên production: division 0–7, playoff_series 1–8. Nút trên web chỉ hiện sau khi code này lên main.",
    color: "#F2B46A",
    home: [2.4, 0, 1.15],
  },
];
