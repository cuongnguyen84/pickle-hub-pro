// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), single: vi.fn(), from: vi.fn(),
  error: vi.fn(), success: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock("@/lib/i18n-standalone", () => ({ tStandalone: (key: string) => key }));
import { useQuickTableMutations, QuickTableScoreSaveError } from "../useQuickTableMutations";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function prepare(fetchFailure = false) {
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: mocks.single }) }) });
  mocks.single.mockResolvedValue(fetchFailure
    ? { data: null, error: { code: "42501" } }
    : { data: { score_version: 3 }, error: null });
  return renderHook(() => useQuickTableMutations());
}
describe("score save commit result", () => {
  it.each(["VERSION_CONFLICT", "DOWNSTREAM_LOCKED", "OTHER_FAILURE"])(
    "rejects %s so caller success work cannot execute", async code => {
      const { result } = prepare();
      mocks.rpc.mockResolvedValue({ data: { success: false, error: code }, error: null });
      const optimisticWrite = vi.fn();
      await act(async () => {
        await expect((async () => {
          await result.current.updateMatchScore("match", 11, 5);
          optimisticWrite();
          mocks.success("saved");
        })()).rejects.toBeInstanceOf(QuickTableScoreSaveError);
      });
      expect(optimisticWrite).not.toHaveBeenCalled();
      expect(mocks.success).not.toHaveBeenCalled();
      expect(mocks.error).toHaveBeenCalledTimes(1);
      expect(result.current.pending.updateMatchScore).toBe(false);
    },
  );
  it("rejects lookup failure without issuing a score RPC", async () => {
    const { result } = prepare(true);
    await act(async () => {
      await expect(result.current.updateMatchScore("match", 11, 5)).rejects.toMatchObject({ code: "SCORE_LOOKUP_FAILED" });
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(result.current.pending.updateMatchScore).toBe(false);
  });
  it("resolves only a confirmed commit and preserves expected version", async () => {
    const { result } = prepare();
    mocks.rpc.mockResolvedValue({ data: { success: true }, error: null });
    const afterCommit = vi.fn();
    await act(async () => {
      await result.current.updateMatchScore("match", 11, 5);
      afterCommit();
    });
    expect(afterCommit).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("score_quick_table_match_atomic", {
      p_match_id: "match", p_score1: 11, p_score2: 5, p_expected_version: 3,
    });
    expect(result.current.pending.updateMatchScore).toBe(false);
  });
});
