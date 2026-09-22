// Pure presentation/parsing: no AI call, no mutation and no transport-status = completion shortcut.
export type TaskProgress = {
  id: number; telegram_id?: number | null; title: string; status: string;
  reason?: string; detail?: string; next_step?: string; updated_at?: string;
  owner?: string; has_report?: boolean; note_updated_at?: string;
  decision?: { summary: string; instructions: string; action?: "reports" | "embeds" | "instagram_token" };
  can_verify?: boolean;
  action?: { phase?: string; pr?: string; head?: string; followup_at?: number };
  verification?: { phase?: string; acceptance?: string; checked_at?: string; automatic?: boolean; cadence?: string };
  attempts?: number; priority?: boolean; related_task_id?: number | null;
};
export type TeamSnapshot = {
  schema: "team-v2.snapshot.v1"; updated_at: string; heartbeat_at: string; tasks: TaskProgress[]; content_calendar?: string;
  controller?: { paused: boolean; provider: string; execution_mode: string };
};

export function progressTarget(value: string): string | null {
  const match = /^(T|XL)-?([1-9]\d*)$/i.exec(value.trim());
  return match ? `${match[1].toUpperCase()}${match[2]}` : null;
}

export function executionReceipt(codes: string[]): string {
  return `⏳ ĐÃ NHẬN ${codes.join(', ')} · CHỜ BẮT ĐẦU\nYêu cầu đã được lưu. Khi máy bắt đầu thực hiện, bot sẽ gửi “ĐANG XỬ LÝ”; khi kết thúc sẽ gửi kết quả hoặc lý do bị chặn.\nAnh không cần bấm lại. Bấm Theo dõi bên dưới để xem trạng thái.`;
}

export function withPendingExecutions(snapshot: TeamSnapshot | null, pending: { text: string }[]): TeamSnapshot | null {
  if (!snapshot) return null;
  const codes = new Set(pending.flatMap(row => {
    const match = /^\/xuly\s+team\s+execute\s+((?:T|XL)[1-9]\d*(?:,(?:T|XL)[1-9]\d*)*)$/i.exec(row.text.trim());
    return match ? match[1].toUpperCase().split(',') : [];
  }));
  return { ...snapshot, tasks: snapshot.tasks.map(task => {
    if ((!codes.has(`T${task.id}`) && !codes.has(`XL${task.telegram_id}`)) ||
        ['resolved', 'cancelled', 'running'].includes(task.status) ||
        ['running', 'awaiting_ci', 'deploying'].includes(task.action?.phase || '')) return task;
    return { ...task, status: 'queued', action: { ...task.action, phase: 'queued' },
      reason: 'Telegram đã nhận yêu cầu xử lý; máy điều phối chưa nhận lượt này.',
      next_step: 'Chờ bot báo ĐANG XỬ LÝ. Anh không cần bấm lại.' };
  }) };
}

export function isProgressCommand(text: string): boolean {
  return /^\/(tien_do|tien-do|viec|lich_content)(?:@\w+)?(?:\s|$)/i.test(text.trim()) ||
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
    if (!data.tasks.every((task: TaskProgress) =>
      [task.reason, task.detail, task.next_step, task.owner, task.note_updated_at].every(v => v == null || typeof v === "string") &&
      (!task.decision || (typeof task.decision.summary === "string" && typeof task.decision.instructions === "string")))) return null;
    return data;
  } catch { return null; }
}

const STATUS: Record<string, string> = {
  queued: "Đang chờ, chưa chạy", running: "Đang xử lý", blocked: "Đang bị chặn",
  open: "Cần xử lý", awaiting_review: "Đội còn bước kiểm chứng/triển khai",
  needs_review: "Bị gián đoạn hoặc cần kiểm tra", resolved: "Đã đóng việc — xem kết quả bên dưới",
  cancelled: "Đã huỷ", error: "Xử lý lỗi",
};
const stamp = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

const PAGE_SIZE = 5;
const closed = (task: TaskProgress) => ["resolved", "cancelled"].includes(task.status);
const short = (value: string, max: number) => value.length > max ? value.slice(0, max - 1) + "…" : value;
const roles: Record<string, string> = { chief: "Điều phối", community: "Cộng đồng", platform: "Vận hành", growth: "Tăng trưởng", editorial: "Nội dung", engineering: "Kỹ thuật" };
const nextStep = (task: TaskProgress) => task.next_step || ({
  queued: "Bộ điều phối lấy việc ở lượt chạy kế tiếp nếu không bị chặn; chưa có giờ hoàn tất.",
  running: "Chờ kết quả lượt hiện tại rồi kiểm chứng; chưa xác nhận triển khai.",
  open: "Đội cần điều tra và thực hiện. Cảnh báo này chưa được đưa vào hàng chờ thực thi.",
  awaiting_review: "Đội phải kiểm chứng bản nháp và chuẩn bị bước triển khai; bộ điều phối chưa tự thực hiện bước này.",
  needs_review: "Đội phải kiểm tra lỗi và phần đã làm trước khi tiếp tục; hiện không tự chạy lại.",
}[task.status] || "Chưa ghi bước tiếp theo; đội cần bổ sung.");

function selection(snapshot: TeamSnapshot, target?: string) {
  const code = progressTarget(target || "");
  if (code) return { tasks: snapshot.tasks.filter(t => code === `T${t.id}` || code === `XL${t.telegram_id}`), page: 1, pages: 1, detail: true, done: false };
  const match = /^(?:(xong)(?:\s+([1-9]\d*))?|([1-9]\d*))$/.exec(target || "1");
  if (!match) return null;
  const done = Boolean(match[1]);
  const tasks = snapshot.tasks.filter(t => done ? closed(t) : !closed(t)).sort((a, b) =>
    done ? b.id - a.id : Number(Boolean(b.decision)) - Number(Boolean(a.decision)) ||
      Number(b.status === "running") - Number(a.status === "running") ||
      Number(b.status === "needs_review") - Number(a.status === "needs_review") || Number(Boolean(b.priority)) - Number(Boolean(a.priority)) || a.id - b.id);
  const pages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const page = Math.min(Number(match[2] || match[3] || 1), pages);
  return { tasks: tasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, pages, detail: false, done };
}

export function progressCallback(data: string): string | undefined {
  if (data === "calendar") return "/lich_content";
  const deploy = /^deploy\|(T[1-9]\d*)\|([0-9a-f]{12})$/.exec(data);
  if (deploy) return `/xuly team deploy ${deploy[1]} ${deploy[2]}`;
  const task = /^(progress|report|priority|verify|ownerdone|tokenhelp|execute)\|((?:T|XL)[1-9]\d*)$/.exec(data);
  if (task) return `${{ progress: "/tien_do", report: "/xuly team report", priority: "/lamngay", verify: "/xuly team verify", ownerdone: "/xuly team owner_done", tokenhelp: "/xuly team token_help", execute: "/xuly team execute" }[task[1]]} ${task[2]}`;
  const page = /^progress\|(page|done):([1-9]\d{0,5})$/.exec(data);
  if (page) return `/tien_do ${page[1] === "done" ? "xong " : ""}${page[2]}`;
  // Callback lạ thì không sinh ra lệnh nào — trả undefined tường minh để
  // noImplicitReturns không phải đoán (TS7030).
  return undefined;
}

export function progressKeyboard(snapshot: TeamSnapshot | null, target?: string, now = Date.now()) {
  const selected = snapshot && selection(snapshot, target);
  const rows: ({ text: string; callback_data: string } | { text: string; url: string })[][] = [];
  for (const task of selected?.tasks || []) {
    if (!closed(task) && snapshot && !isStale(snapshot, now)) {
      if (task.action?.phase === 'awaiting_deploy' && /^[0-9a-f]{40}$/.test(task.action.head || '') &&
          /^https:\/\/github.com\/cuongnguyen84\/pickle-hub-pro\/pull\/\d+$/.test(task.action.pr || '')) {
        rows.push([{ text: `Duyệt triển khai T${task.id}`, callback_data: `deploy|T${task.id}|${task.action.head!.slice(0, 12)}` },
          { text: 'Xem thay đổi', url: task.action.pr! }]);
      } else if (!['queued', 'running', 'awaiting_ci', 'deploying'].includes(task.action?.phase || '') && task.status !== 'running') {
        rows.push([{ text: `Xử lý ngay T${task.id}`, callback_data: `execute|T${task.id}` }]);
      }
    }
    if (!selected?.detail) rows.push([{ text: `${task.decision ? "Cần anh: " : "Chi tiết "}T${task.id}`, callback_data: `progress|T${task.id}` }]);
    else {
      if (task.decision?.action === "reports") rows.push([{ text: "Mở báo cáo để quyết định", url: "https://www.thepicklehub.net/admin/reports" }]);
      if (task.decision?.action === "embeds") rows.push([{ text: "Xem nguồn Instagram cần nối lại", url: "https://www.thepicklehub.net/admin/embeds" }]);
      if (task.decision?.action === "instagram_token") {
        rows.push([{ text: "1. Lấy token Meta", url: "https://developers.facebook.com/tools/explorer/" }]);
        rows.push([{ text: "2. Lưu token vào Supabase", url: "https://supabase.com/dashboard/project/ajvlcamxemgbxduhiqrl/functions/secrets" }]);
        rows.push([{ text: "Cần hỗ trợ lấy token", callback_data: `tokenhelp|T${task.id}` }]);
      }
      if (task.can_verify) {
        if (!closed(task) && task.decision) rows.push([{ text: `Đã sửa → kiểm tra lại T${task.id}`, callback_data: `ownerdone|T${task.id}` }]);
        rows.push([{ text: `Kiểm tra mới T${task.id}`, callback_data: `verify|T${task.id}` }]);
      }
      if (task.has_report) rows.push([{ text: `Đọc báo cáo T${task.id}`, callback_data: `report|T${task.id}` }]);
      if (task.status === "queued" && snapshot && !isStale(snapshot, now)) rows.push([{ text: `Ưu tiên T${task.id}`, callback_data: `priority|T${task.id}` }]);
    }
  }
  if (selected && !selected.detail) {
    const nav = [];
    const prefix = selected.done ? "done" : "page";
    if (selected.page > 1) nav.push({ text: "← Trang trước", callback_data: `progress|${prefix}:${selected.page - 1}` });
    if (selected.page < selected.pages) nav.push({ text: "Trang sau →", callback_data: `progress|${prefix}:${selected.page + 1}` });
    if (nav.length) rows.push(nav);
  }
  rows.push([{ text: "Tiến độ toàn đội", callback_data: "progress|page:1" }, { text: "Việc đã đóng", callback_data: "progress|done:1" }]);
  rows.push([{ text: "Lịch nội dung", callback_data: "calendar" }]);
  return { inline_keyboard: rows };
}

const isStale = (snapshot: TeamSnapshot, now: number) =>
  now - Math.min(Date.parse(snapshot.heartbeat_at), Date.parse(snapshot.updated_at)) > 20 * 60_000;

export function renderProgress(snapshot: TeamSnapshot | null, target?: string, now = Date.now()): string {
  if (!snapshot) return "Chưa đọc được sổ tiến độ của agent. Đây không có nghĩa là hàng chờ trống. Anh không cần giao lại việc.\nBấm Tiến độ toàn đội bên dưới để đọc lại.";
  const selected = selection(snapshot, target);
  if (!selected) return "Mã chưa đúng. Dùng /tien_do T47, /tien_do 2 hoặc /tien_do xong. Các nút bên dưới đã điền sẵn lệnh.";
  const open = snapshot.tasks.filter(t => !closed(t));
  const count = (status: string) => open.filter(t => t.status === status).length;
  const decisions = open.filter(t => t.decision).length;
  const header = ["TIẾN ĐỘ CÔNG VIỆC", `Đồng bộ: ${stamp(snapshot.updated_at)} (giờ Việt Nam)`,
    ...(isStale(snapshot, now) ? ["⚠️ Dữ liệu/nhịp agent cũ hơn 20 phút. Đây là trạng thái gần nhất, không xác nhận đang chạy."] : []),
    `${open.length} việc mở · ${count("running")} đang xử lý · ${count("queued")} chờ chạy · ${decisions} cần anh cung cấp/quyết định.`,
    `${open.filter(t => t.verification?.automatic).length} việc có lịch kiểm chứng tự động; kiểm chứng không đồng nghĩa đang sửa lỗi.`,
    ...(snapshot.controller?.paused ? ["⏸ Bộ điều phối đang tạm dừng."] : []),
    ...(!count("running") && !count("queued") && open.length ? ["Hiện không có việc tồn nào đang được thực thi. Lịch giám sát vẫn có thể chạy."] : []),
  ];
  if (!selected.tasks.length && selected.detail) return [...header, `Chưa tìm thấy ${target}. Không thể kết luận việc đã xong.`, "Xem danh sách: /tien_do"].join("\n");
  const lines = selected.tasks.map(task => selected.detail ? [
    `T${task.id}${task.telegram_id ? ` / XL${task.telegram_id}` : ""} · ${STATUS[task.status] || "Chưa rõ trạng thái"}`,
    short(task.title, 200),
    `Phụ trách: ${roles[task.owner || ""] || task.owner || "Chưa ghi người phụ trách"}`,
    ...(task.action?.phase ? [`Lượt xử lý: ${{ queued: 'đã xếp hàng', running: 'đang thực hiện', awaiting_ci: 'đang chờ CI để tự triển khai', blocked: 'bị chặn — xem lý do', awaiting_deploy: 'đã kiểm tra, chờ duyệt triển khai', deploying: 'đã duyệt, chờ kiểm chứng production', complete: 'đã hoàn tất', waiting_followup: 'đã đo, đã hẹn lượt đo tiếp', measured: 'đã đo, cần đối chiếu kết luận' }[task.action.phase] || task.action.phase}`] : []),
    `Đã biết: ${short(task.reason || task.detail || "Chưa ghi kết quả có bằng chứng.", 550)}`,
    `Tiếp theo: ${short(nextStep(task), 300)}`,
    ...(task.action?.phase === "waiting_followup" && Number.isFinite(task.action.followup_at) ?
      [`Lượt đo tiếp: ${stamp(new Date(task.action.followup_at! * 1000).toISOString())} (giờ Việt Nam). Anh không cần bấm lại.`] : []),
    task.decision ? `CẦN ANH: ${short(task.decision.summary, 200)}\n${short(task.decision.instructions, 1000)}` : closed(task) ? "Anh không cần thao tác thêm; agent tiếp tục theo dõi." : "Anh cần làm gì: Chưa ghi nhận quyết định cần anh. Đội phải xử lý bước tiếp theo; không cần giao lại việc.",
    ...(task.verification?.acceptance ? [`Điều kiện đóng: ${short(task.verification.acceptance, 220)}`,
      `Kiểm chứng: ${task.verification.checked_at ? stamp(task.verification.checked_at) : "chưa có"} · ${task.verification.cadence || "chưa có lịch"}`,
      ...(task.verification.phase === "unverified" ? ["⚠️ Lần đọc mới thất bại; chưa xác nhận lại trạng thái trước đó."] : [])] : []),
    `Lịch hoàn tất: ${closed(task) ? "Đã đóng trong sổ; xem bằng chứng kết quả." : "Chưa có mốc được xác nhận."}`,
    `Trạng thái việc cập nhật: ${task.updated_at ? stamp(task.updated_at) : "chưa rõ"}. Ghi chú: ${task.note_updated_at ? stamp(task.note_updated_at) : "chưa ghi ngày, có thể đã cũ"}.`,
    `Số lần bắt đầu: ${task.attempts ?? 0}`,
    `Lệnh xem lại: /tien_do T${task.id}`,
    ...(task.has_report ? [`Lệnh đọc báo cáo: /xuly team report T${task.id}`] : []),
  ].join("\n") : [
    `T${task.id} · ${short(task.title, 75)}`,
    `${roles[task.owner || ""] || task.owner || "Chưa phân công"} · ${STATUS[task.status] || task.status}`,
    `Hiện tại: ${short(task.reason || task.detail || "Chưa ghi kết quả có bằng chứng.", 110)}`,
    `Tiếp: ${short(task.decision ? `Cần anh: ${task.decision.summary}` : nextStep(task), 130)}`,
    `/tien_do T${task.id}`,
  ].join("\n"));
  return [...header, ...lines,
    ...(!lines.length ? [selected.done ? "Chưa có việc đã đóng." : "Không có việc đang mở trong sổ đã đồng bộ."] : []),
    ...(!selected.detail ? [`Trang ${selected.page}/${selected.pages} · ${selected.done ? "Việc đã đóng" : "Việc còn mở"}. Bấm mã việc để xem đầy đủ và lệnh xử lý.`,
      "Đã có nháp ≠ đã triển khai. Các cảnh báo có bộ đo sẽ tự kiểm chứng, báo đóng và mở lại nếu lỗi tái diễn."] : []),
  ].join("\n\n");
}
