import { describe, expect, it, vi } from "vitest";
import { saveQuickTableScore, QuickTableScoreSaveError } from "../quickTableScoreSave";
function fixture() {
  return {
    store: {
      fetchVersion: vi.fn().mockResolvedValue({ data: { score_version: 3 }, error: null }),
      commit: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
    feedback: { error: vi.fn(), log: vi.fn(), permissionDenied: "Permission denied" },
  };
}
describe("score commit boundary", () => {
  it.each([
    [{ data: { success: false, error: "VERSION_CONFLICT" }, error: null }, "Điểm vừa được cập nhật ở thiết bị khác. Hãy tải lại."],
    [{ data: { success: false, error: "DOWNSTREAM_LOCKED" }, error: null }, "Không thể sửa vì trận tiếp theo đã bắt đầu."],
    [{ data: null, error: { code: "42501" } }, "Permission denied"],
    [{ data: null, error: { code: "OTHER" } }, "Không thể lưu điểm."],
    [{ data: { success: false, error: "Rejected" }, error: null }, "Rejected"],
  ])("rejects failed saves and reports once", async (response, message) => {
    const { store, feedback } = fixture();
    store.commit.mockResolvedValue(response);
    const optimistic = vi.fn();
    await expect((async () => { await saveQuickTableScore(store, feedback); optimistic(); })())
      .rejects.toBeInstanceOf(QuickTableScoreSaveError);
    expect(feedback.error).toHaveBeenCalledExactlyOnceWith(message);
    expect(optimistic).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: null }, { data: null, error: { code: "42501" } }])(
    "does not commit after failed lookup", async lookup => {
      const { store, feedback } = fixture();
      store.fetchVersion.mockResolvedValue(lookup);
      await expect(saveQuickTableScore(store, feedback)).rejects.toMatchObject({ code: "SCORE_LOOKUP_FAILED" });
      expect(store.commit).not.toHaveBeenCalled();
    },
  );
  it("resolves only confirmed success and forwards expected version", async () => {
    const { store, feedback } = fixture();
    await expect(saveQuickTableScore(store, feedback)).resolves.toBeUndefined();
    expect(store.commit).toHaveBeenCalledExactlyOnceWith(3);
    expect(feedback.error).not.toHaveBeenCalled();
  });
  it("propagates transport exceptions as failures", async () => {
    const { store, feedback } = fixture();
    store.commit.mockRejectedValue(new Error("offline"));
    await expect(saveQuickTableScore(store, feedback)).rejects.toThrow("offline");
  });
});
