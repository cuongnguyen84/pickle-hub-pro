import { describe, expect, it } from "vitest";
import { renderFlexTournament, renderQuickTable } from "../render/tournaments";
import type { SupabaseClient } from "../supabase";

// SSR dùng service-role (bypass RLS) nên gate is_public nằm trong chính
// render handler — các test này ghim lại: private phải 404 y hệt không tồn tại.
function fakeSupabase(row: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: row, error: row ? null : { code: "PGRST116" } }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const SITE = "https://www.thepicklehub.net";

describe("renderFlexTournament privacy gate", () => {
  it("returns 404 for a private tournament and never leaks its name", async () => {
    const res = await renderFlexTournament(
      fakeSupabase({ id: "1", name: "Giải Bí Mật", status: "active", share_id: "abc", is_public: false }),
      "abc",
      SITE,
    );
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("Giải Bí Mật");
  });

  it("renders a public tournament with 200", async () => {
    const res = await renderFlexTournament(
      fakeSupabase({ id: "1", name: "Giải Công Khai", status: "active", share_id: "abc", is_public: true }),
      "abc",
      SITE,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Giải Công Khai");
  });
});

describe("renderQuickTable privacy gate", () => {
  it("returns 404 for a private table and never leaks its name", async () => {
    const res = await renderQuickTable(
      fakeSupabase({ id: "1", name: "Bảng Kín", format: "round_robin", player_count: 8, status: "completed", share_id: "qt1", is_public: false }),
      "qt1",
      SITE,
    );
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("Bảng Kín");
  });

  it("renders a public table with 200", async () => {
    const res = await renderQuickTable(
      fakeSupabase({ id: "1", name: "Bảng Mở", format: "round_robin", player_count: 8, status: "completed", share_id: "qt1", is_public: true }),
      "qt1",
      SITE,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Bảng Mở");
  });

  it("still 404s when the row does not exist", async () => {
    const res = await renderQuickTable(fakeSupabase(null), "nope", SITE);
    expect(res.status).toBe(404);
  });
});
