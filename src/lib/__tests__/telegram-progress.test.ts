import { describe, it, expect } from "vitest";
import { isProgressCommand, parseSnapshot, progressTarget, renderProgress, renderContentCalendar } from "../../../supabase/functions/ops-job-control/progress";

describe("Telegram progress", () => {
  const now = "2026-09-13T05:00:00Z";
  const snapshot = { schema: "team-v2.snapshot.v1" as const, updated_at: now, heartbeat_at: now,
    tasks: [{ id: 47, telegram_id: 136, title: "Update article", status: "queued", attempts: 0, reason: "quota" }] };
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
});
