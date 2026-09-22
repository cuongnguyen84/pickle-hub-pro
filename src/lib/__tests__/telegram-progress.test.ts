import { describe, it, expect } from "vitest";
import { isProgressCommand, parseSnapshot, progressTarget, renderProgress, renderContentCalendar, progressKeyboard, progressCallback, executionReceipt, withPendingExecutions } from "../../../supabase/functions/ops-job-control/progress";

describe("Telegram progress", () => {
  it('routes execution and binds deployment to a revision', () => {
    expect(progressCallback('execute|T28')).toBe('/xuly team execute T28');
    expect(progressCallback('deploy|T28|abcdef123456')).toBe('/xuly team deploy T28 abcdef123456');
    for (const value of ['deploy|T28', 'deploy|T28|latest', 'execute|T28;rm', 'deploy|T0|abcdef123456']) {
      expect(progressCallback(value)).toBeUndefined();
    }
  });
  const now = "2026-09-13T05:00:00Z";
  const snapshot = { schema: "team-v2.snapshot.v1" as const, updated_at: now, heartbeat_at: now,
    tasks: [{ id: 47, telegram_id: 136, title: "Update article", status: "queued", attempts: 0, reason: "quota" }] };
  it("shows a durable pending request immediately without changing the saved snapshot", () => {
    const saved = { ...snapshot, tasks: [{ ...snapshot.tasks[0], status: "open" }] };
    const pending = withPendingExecutions(saved, [{ text: "/xuly team execute XL136,T28" }])!;
    expect(saved.tasks[0].status).toBe("open");
    expect(pending.tasks[0].status).toBe("queued");
    expect(renderProgress(pending, "T47", Date.parse(now))).toContain("máy điều phối chưa nhận lượt này");
    expect(JSON.stringify(progressKeyboard(pending, "T47", Date.parse(now)))).not.toContain("execute|T47");
    expect(executionReceipt(["T47"])).toContain("CHỜ BẮT ĐẦU");
    expect(withPendingExecutions(null, [{ text: "/xuly team execute T47" }])).toBeNull();
  });
  it("does not overwrite running or closed work with an old pending request", () => {
    for (const status of ["running", "resolved", "cancelled"]) {
      const saved = { ...snapshot, tasks: [{ ...snapshot.tasks[0], status }] };
      expect(withPendingExecutions(saved, [{ text: "/xuly team execute T47" }])).toEqual(saved);
    }
    for (const phase of ["running", "awaiting_ci", "deploying"]) {
      const saved = { ...snapshot, tasks: [{ ...snapshot.tasks[0], status: "open", action: { phase } }] };
      expect(withPendingExecutions(saved, [{ text: "/xuly team execute T47" }])).toEqual(saved);
    }
    expect(withPendingExecutions(snapshot, [{ text: "/xuly team execute T47 do something else" }])).toEqual(snapshot);
  });
  it("only asks the owner to confirm a fix when an owner decision is required", () => {
    const data = { ...snapshot, tasks: [{ ...snapshot.tasks[0], status: "open", can_verify: true,
      action: { phase: "waiting_followup", followup_at: Date.parse(now) / 1000 + 86400 } }] };
    expect(JSON.stringify(progressKeyboard(data, "T47"))).not.toContain("ownerdone|");
    expect(renderProgress(data, "T47", Date.parse(now))).toContain("đã đo, đã hẹn lượt đo tiếp");
    expect(renderProgress(data, "T47", Date.parse(now))).toContain("Lượt đo tiếp:");
  });
  it("shows the stored calendar without inventing one or calling AI", () => {
    expect(isProgressCommand('/lich_content')).toBe(true);
    expect(renderContentCalendar({ ...snapshot, content_calendar: '15/09 Kuala Lumpur' }, Date.parse(now))).toContain('15/09 Kuala Lumpur');
    expect(renderContentCalendar(null)).toContain('Không có nghĩa');
    expect(renderContentCalendar(snapshot, Date.parse(now))).toContain('Chưa đồng bộ');
    expect(renderContentCalendar(snapshot, Date.parse(now) + 1_300_000)).toContain('Lịch lưu gần nhất');
  });
  it("routes legacy and direct controls as reads", () => {
    for (const text of ["/viec", "/tien_do T47", "/xuly team inbox", "/xuly@Bot team status"]) expect(isProgressCommand(text)).toBe(true);
    expect(isProgressCommand("/xuly update article")).toBe(false);
  });
  it("matches stable T and XL references", () => {
    expect(progressTarget("XL-136")).toBe("XL136");
    expect(progressTarget("T0")).toBeNull();
    expect(renderProgress(snapshot, "XL136", Date.parse(now))).toContain("Số lần bắt đầu: 0");
    expect(renderProgress(snapshot, "T47", Date.parse(now))).toContain("quota");
  });
  it("does not confuse unavailable data with an empty queue", () => {
    expect(parseSnapshot("broken")).toBeNull();
    expect(renderProgress(null)).toContain("không có nghĩa là hàng chờ trống");
    expect(renderProgress(snapshot, "T99")).toContain("Không thể kết luận việc đã xong");
  });
  it("warns on stale snapshots and hides resolved jobs from inbox", () => {
    expect(renderProgress(snapshot, undefined, Date.parse(now) + 1_300_000)).toContain("20 phút");
    expect(renderProgress({ ...snapshot, tasks: [{ ...snapshot.tasks[0], status: "resolved" }] }, undefined, Date.parse(now))).toContain("Không có việc đang mở");
  });
  it("paginates every task and round-trips each button without cutting off actions", () => {
    const tasks = Array.from({ length: 27 }, (_, i) => ({ ...snapshot.tasks[0], id: i + 1, title: "x".repeat(500), reason: "r".repeat(1500), next_step: "n".repeat(1500) }));
    const data = { ...snapshot, tasks };
    const seen = new Set<string>();
    for (let page = 1; page <= 6; page++) {
      const text = renderProgress(data, String(page), Date.parse(now));
      expect(text.length).toBeLessThan(3900);
      expect(text).toContain(`Trang ${page}/6`);
      for (const row of progressKeyboard(data, String(page)).inline_keyboard) for (const button of row) {
        if (!("callback_data" in button)) continue;
        expect(progressCallback(button.callback_data)).toBeTruthy();
        if (/^progress\|T/.test(button.callback_data)) seen.add(button.callback_data);
      }
    }
    expect(seen.size).toBe(27);
    expect(renderProgress(data, "T1", Date.parse(now)).length).toBeLessThan(3900);
  });
  it("makes idle work and owner decisions explicit without inventing approval", () => {
    const data = { ...snapshot, tasks: [{ ...snapshot.tasks[0], status: "needs_review", owner: "engineering", decision: { summary: "Cần bằng chứng quyền", instructions: "Cung cấp nguồn xác nhận.", action: "reports" as const } }] };
    expect(renderProgress(data, undefined, Date.parse(now))).toContain("không có việc tồn nào đang được thực thi");
    expect(renderProgress(data, "T47", Date.parse(now))).toContain("CẦN ANH: Cần bằng chứng quyền");
    expect(JSON.stringify(progressKeyboard(data, "T47"))).toContain("https://www.thepicklehub.net/admin/reports");
    expect(renderProgress(data, "T47", Date.parse(now))).toContain("Chưa có mốc được xác nhận");
    expect(JSON.stringify(progressKeyboard(data, "T47", Date.parse(now)))).not.toContain("priority|");
    expect(JSON.stringify(progressKeyboard(snapshot, "T47", Date.parse(now)))).toContain("priority|T47");
  });
  it("disables priority for stale data and rejects arbitrary callback commands", () => {
    const data = { ...snapshot, updated_at: "2026-09-12T00:00:00Z" };
    expect(renderProgress(data, undefined, Date.parse(now))).toContain("20 phút");
    expect(JSON.stringify(progressKeyboard(data, "T47", Date.parse(now)))).not.toContain("priority|");
    for (const invalid of ["report|T47 cancel", "priority|T0", "progress|page:0", "approve|T47", "report|../../secret"]) expect(progressCallback(invalid)).toBeUndefined();
    expect(isProgressCommand("/tien-do")).toBe(true);
    expect(progressCallback("progress|XL149")).toBe("/tien_do XL149");
    expect(parseSnapshot({ ...snapshot, tasks: [{ ...snapshot.tasks[0], decision: { summary: 12 } }] })).toBeNull();
  });
  it("keeps closed tasks accessible and does not use unrelated example task buttons", () => {
    const data = { ...snapshot, tasks: [{ ...snapshot.tasks[0], id: 62, status: "resolved" }] };
    expect(renderProgress(data, "xong", Date.parse(now))).toContain("T62");
    expect(JSON.stringify(progressKeyboard(data, "xong"))).toContain("progress|T62");
    expect(renderProgress(data, "xong", Date.parse(now))).not.toContain("/lamngay T47");
  });

  it("offers a real verification loop and exact token destinations", () => {
    const data = { ...snapshot, tasks: [{ ...snapshot.tasks[0], id: 26, status: "open", can_verify: true,
      verification: { phase: "owner_action", acceptance: "Every active source succeeds", checked_at: now, automatic: true, cadence: "Mỗi 5 phút" },
      decision: { summary: "Thay token chung", instructions: "Lưu IG_ACCESS_TOKEN, rồi bấm kiểm tra lại.", action: "instagram_token" as const } }] };
    const keyboard = progressKeyboard(data, "T26");
    const buttons = keyboard.inline_keyboard.flat();
    expect(buttons).toContainEqual({ text: "1. Lấy token Meta", url: "https://developers.facebook.com/tools/explorer/" });
    expect(buttons).toContainEqual({ text: "2. Lưu token vào Supabase", url: "https://supabase.com/dashboard/project/ajvlcamxemgbxduhiqrl/functions/secrets" });
    expect(buttons).toContainEqual({ text: "Đã sửa → kiểm tra lại T26", callback_data: "ownerdone|T26" });
    expect(progressCallback("ownerdone|T26")).toBe("/xuly team owner_done T26");
    expect(progressCallback("verify|T26")).toBe("/xuly team verify T26");
    expect(progressCallback("tokenhelp|T26")).toBe("/xuly team token_help T26");
    expect(progressCallback("ownerdone|T26 deploy")).toBeUndefined();
    expect(renderProgress(data, "T26", Date.parse(now))).toContain("Điều kiện đóng: Every active source succeeds");
    const resolved = { ...data, tasks: [{ ...data.tasks[0], status: "resolved", decision: undefined }] };
    expect(JSON.stringify(progressKeyboard(resolved, "T26"))).not.toContain("ownerdone|");
    expect(renderProgress(resolved, "T26", Date.parse(now))).toContain("Anh không cần thao tác thêm");
  });

});
