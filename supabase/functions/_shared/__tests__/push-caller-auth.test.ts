import { describe, it, expect } from "vitest";
import { classifyPushCaller } from "../../send-push-notification/handler.ts";

// Cổng xác thực của send-push-notification. Trước 18/08 nó nằm chôn trong
// Deno.serve và không test nào chạm tới — nên khi hàm được siết lại, mọi
// trigger Postgres bắt đầu nhận 401 mà không gate nào kêu. Đo trên production
// bằng chính pg_net: req 62590 → 401 {"error":"Unauthorized"}.
//
// File này khoá đúng cái đã im lặng gãy.

const ENV = { serviceRoleKey: "svc-key-abc", cronSecret: "cron-secret-xyz" };
const none = { authorization: null, cronSecret: null };

describe("classifyPushCaller", () => {
  it("nhận trigger Postgres qua x-cron-secret", () => {
    expect(
      classifyPushCaller({ ...none, cronSecret: "cron-secret-xyz" }, ENV),
    ).toBe("internal_trigger");
  });

  it("trigger được nhận kể cả khi kèm Authorization vô dụng — pg_net vẫn gửi anon key", () => {
    expect(
      classifyPushCaller(
        { authorization: "Bearer anon-key", cronSecret: "cron-secret-xyz" },
        ENV,
      ),
    ).toBe("internal_trigger");
  });

  it("nhận service-role bearer", () => {
    expect(
      classifyPushCaller({ ...none, authorization: "Bearer svc-key-abc" }, ENV),
    ).toBe("service_role");
  });

  // ── Đây là lỗi thật, viết lại thành test ──────────────────────────────────
  it("anon key KHÔNG được coi là người gọi nội bộ", () => {
    // Đúng thứ 2 trigger cũ đang gửi. Phải rơi xuống đường user_jwt, nơi
    // index.ts bắt xác minh JWT + vai admin — và anon key trượt cả hai.
    expect(
      classifyPushCaller({ ...none, authorization: "Bearer anon-key" }, ENV),
    ).toBe("user_jwt");
  });

  it("thiếu CRON_SECRET thì header rỗng KHÔNG mở cửa", () => {
    expect(
      classifyPushCaller({ ...none, cronSecret: "" }, {
        serviceRoleKey: "svc-key-abc",
        cronSecret: "",
      }),
    ).toBe("missing");
    expect(
      classifyPushCaller({ ...none, cronSecret: "" }, {
        serviceRoleKey: "svc-key-abc",
        cronSecret: undefined,
      }),
    ).toBe("missing");
  });

  it("thiếu SUPABASE_SERVICE_ROLE_KEY thì bearer rỗng KHÔNG thành service_role", () => {
    // Cái bẫy `"" === ""`. Cũ viết `bearer === serviceRoleKey` trần.
    expect(
      classifyPushCaller({ ...none, authorization: "Bearer " }, {
        serviceRoleKey: "",
        cronSecret: "cron-secret-xyz",
      }),
    ).toBe("missing");
    expect(
      classifyPushCaller({ ...none, authorization: "Bearer x" }, {
        serviceRoleKey: undefined,
        cronSecret: "cron-secret-xyz",
      }),
    ).toBe("user_jwt");
  });

  it("cron secret sai một ký tự là không phải trigger", () => {
    expect(
      classifyPushCaller({ ...none, cronSecret: "cron-secret-xy" }, ENV),
    ).toBe("missing");
  });

  it("không xuất trình gì thì là missing", () => {
    expect(classifyPushCaller(none, ENV)).toBe("missing");
  });
});
