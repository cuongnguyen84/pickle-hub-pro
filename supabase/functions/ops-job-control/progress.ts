// Pure presentation/parsing: no AI call, no mutation and no transport-status = completion shortcut.
export type TaskProgress = {
  id: number; telegram_id?: number | null; title: string; status: string;
  reason?: string; detail?: string; next_step?: string; updated_at?: string;
  attempts?: number; priority?: boolean; related_task_id?: number | null;
};
export type TeamSnapshot = {
  schema: "team-v2.snapshot.v1"; updated_at: string; heartbeat_at: string; tasks: TaskProgress[]; content_calendar?: string;
};

export function progressTarget(value: string): string | null {
  const match = /^(T|XL)-?([1-9]\d*)$/i.exec(value.trim());
  return match ? `${match[1].toUpperCase()}${match[2]}` : null;
}

export function isProgressCommand(text: string): boolean {
  return /^\/(tien_do|viec|lich_content)(?:@\w+)?(?:\s|$)/i.test(text.trim()) ||
    /^\/xuly(?:@\w+)?\s+team\s+(inbox|status)\s*$/i.test(text.trim());
}

export function renderContentCalendar(snapshot: TeamSnapshot | null, now = Date.now()): string {
  if (!snapshot) return "Chưa đọc được lịch content. Không có nghĩa là không có lịch; đội cần kiểm tra kết nối.";
  const stale = now - Date.parse(snapshot.updated_at) > 20 * 60_000;
  return [stale ? "⚠️ Lịch lưu gần nhất, chưa xác nhận trạng thái mới." : "",
    typeof snapshot.content_calendar === "string" ? snapshot.content_calendar.slice(0, 3400) : "Chưa đồng bộ lịch content; đội cần kiểm tra.",
    `Cập nhật: ${stamp(snapshot.updated_at)} (giờ Việt Nam)`].filter(Boolean).join("\n");
}

export function parseSnapshot(value: unknown): TeamSnapshot | null {
  try {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    if (!data || data.schema !== "team-v2.snapshot.v1" || !Array.isArray(data.tasks) ||
      !Number.isFinite(Date.parse(data.heartbeat_at)) || !Number.isFinite(Date.parse(data.updated_at))) return null;
    if (!data.tasks.every((task: TaskProgress) => Number.isSafeInteger(task.id) && task.id > 0 &&
      typeof task.title === "string" && typeof task.status === "string")) return null;
    return data;
  } catch { return null; }
}

const STATUS: Record<string, string> = {
  queued: "Đang chờ, chưa chạy", running: "Đang xử lý", blocked: "Đang bị chặn",
  open: "Cần xử lý", awaiting_review: "Đội cần kiểm chứng kết quả; chưa triển khai, chưa yêu cầu anh duyệt",
  needs_review: "Bị gián đoạn hoặc cần kiểm tra", resolved: "Đã đóng việc — xem kết quả bên dưới",
  cancelled: "Đã huỷ", error: "Xử lý lỗi",
};
const stamp = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export function renderProgress(snapshot: TeamSnapshot | null, target?: string, now = Date.now()): string {
  if (!snapshot) return "Chưa đọc được sổ tiến độ của agent. Đây không có nghĩa là hàng chờ trống. Anh không cần giao lại việc; hãy thử /tien_do sau ít phút.";
  const stale = now - Date.parse(snapshot.heartbeat_at) > 20 * 60_000;
  const header = ["TIẾN ĐỘ CÔNG VIỆC", `Cập nhật: ${stamp(snapshot.updated_at)} (giờ Việt Nam)`,
    ...(stale ? ["⚠️ Agent chưa cập nhật hơn 20 phút. Dưới đây là trạng thái gần nhất, không phải xác nhận đang chạy."] : [])];
  let tasks = snapshot.tasks;
  if (target) {
    const normalized = progressTarget(target);
    if (!normalized) return "Mã chưa đúng. Ví dụ: /tien_do T47 hoặc /tien_do XL136.";
    tasks = tasks.filter((task) => normalized === `T${task.id}` || normalized === `XL${task.telegram_id}`);
    if (!tasks.length) return [...header, `Chưa tìm thấy ${normalized} trong sổ đã đồng bộ. Không thể kết luận việc đã xong.`, "Xem danh sách: /tien_do"].join("\n");
  } else {
    tasks = tasks.filter((task) => !["resolved", "cancelled"].includes(task.status));
  }
  const lines = tasks.slice(0, 15).map((task) => [
    `T${task.id}${task.telegram_id ? ` / XL${task.telegram_id}` : ""} · ${STATUS[task.status] ?? "Chưa rõ trạng thái"}${task.priority ? " · Ưu tiên" : ""}`,
    task.title.slice(0, target ? 300 : 90),
    ...(task.reason || task.detail ? [`Chi tiết: ${(task.reason || task.detail || "").slice(0, target ? 1400 : 100)}`] : []),
    ...(task.next_step ? [`Tiếp theo: ${task.next_step.slice(0, target ? 500 : 100)}`] : []),
    ...(target ? [`Số lần bắt đầu: ${task.attempts ?? 0}`] : []),
  ].join("\n"));
  return [...header, "", ...(lines.length ? lines : ["Không có việc đang mở trong sổ đã đồng bộ."]),
    ...(tasks.length > 15 ? [`Còn ${tasks.length - 15} việc; dùng /tien_do T<mã> để xem cụ thể.`] : []),
    "", "Xem một việc: /tien_do T47", "Yêu cầu ưu tiên: /lamngay T47 (không bỏ qua giới hạn hoặc bước duyệt)",
  ].join("\n\n").slice(0, 3900);
}
