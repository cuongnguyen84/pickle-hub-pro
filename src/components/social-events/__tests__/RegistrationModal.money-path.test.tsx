// @vitest-environment jsdom
// ============================================================================
// ARCH-02 increment 2 — characterization tests for the RegistrationModal
// money path. These pin the CURRENT behavior of the OTP + member
// registration flows (capacity gate, payment branch, error translation,
// localStorage handle) BEFORE the increment-3 hook extraction. If a test
// here breaks during the refactor, the refactor changed behavior — fix
// the refactor, not the test.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RegistrationModal } from "../RegistrationModal";
import type { SocialEventSlot } from "@/hooks/useSocialEvent";

const { rpcMock, invokeMock, toastMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  invokeMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
  useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/journeys", () => ({
  startJourney: vi.fn(),
  trackJourneyStep: vi.fn(),
  completeJourney: vi.fn(),
}));

// Real VI dictionary → assertions pin the actual user-facing copy.
vi.mock("@/i18n", async () => {
  const { vi: viDict } = await import("@/i18n/vi");
  return {
    useI18n: () => ({
      t: viDict,
      language: "vi",
      setLanguage: vi.fn(),
      setLanguageFromUrl: vi.fn(),
    }),
  };
});

// Turnstile auto-verifies on mount so the phone-step submit is enabled.
vi.mock("@/components/registration/TurnstileWidget", async () => {
  const React = await import("react");
  return {
    TurnstileWidget: ({ onVerify }: { onVerify: (t: string) => void }) => {
      // No dep array: re-verify after every render, mirroring the real
      // widget re-issuing a token after the modal clears it on phone change.
      React.useEffect(() => {
        onVerify("tt-token-1");
      });
      return null;
    },
  };
});

// QRPaymentStep stub — renders the reference code so tests can assert the
// payment step was reached with the right order, plus claim/skip buttons to
// drive the PR60-v2 "claim jumps straight to success" transition.
vi.mock("@/components/payment/QRPaymentStep", () => ({
  QRPaymentStep: ({
    order,
    onClaimed,
    onSkip,
  }: {
    order: { reference_code: string; player_claimed_paid: boolean };
    onClaimed: (o: unknown) => void;
    onSkip: () => void;
  }) => (
    <div data-testid="qr-step">
      {order.reference_code}
      <button onClick={() => onClaimed({ ...order, player_claimed_paid: true })}>
        mock-claim
      </button>
      <button onClick={onSkip}>mock-skip</button>
    </div>
  ),
}));

vi.mock("@/components/social-events/FollowOaBanner", () => ({
  FollowOaBanner: () => null,
}));

// input-otp replaced by a plain controlled input — the widget internals are
// not part of the money path under characterization.
vi.mock("@/components/ui/input-otp", () => ({
  InputOTP: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      aria-label="otp-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  InputOTPGroup: () => null,
  InputOTPSlot: () => null,
  InputOTPSeparator: () => null,
}));

const EVENT_ID = "ev-1";
const STORAGE_KEY = `pickle-hub:registration:${EVENT_ID}`;

const MEMBER_ROW = {
  registration_id: "r1",
  profile_id: "p1",
  magic_token: "tok1",
  registered_at: "2026-07-18T00:00:00Z",
};

const VERIFY_OK = {
  ok: true,
  registration_id: "r1",
  profile_id: "p1",
  magic_token: "tok1",
  registered_at: "2026-07-18T00:00:00Z",
};

const BANK = { code: "VCB", account_number: "123456", account_name: "CLB PICKLE" };

const SLOTS: SocialEventSlot[] = [
  {
    id: "s1",
    label: "Nhóm 3.0",
    kind: "skill",
    capacity: 2,
    court_count: null,
    skill_level: "3.0",
    min_play_months: null,
    notes: null,
  },
  {
    id: "s2",
    label: "Nhóm mở",
    kind: "general",
    capacity: 4,
    court_count: null,
    skill_level: null,
    min_play_months: null,
    notes: null,
  },
];

function renderModal(props: Partial<Parameters<typeof RegistrationModal>[0]> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <RegistrationModal
        open
        onOpenChange={vi.fn()}
        eventId={EVENT_ID}
        eventSlug="test-event"
        eventTitle="Test Event"
        priceVnd={0}
        zaloGroupUrl={null}
        {...props}
      />
    </QueryClientProvider>,
  );
}

// vitest runs without `globals: true`, so Testing Library's automatic
// afterEach cleanup never registers — do it explicitly or every test after
// the first queries a document with multiple stale modals in it.
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Default: slot-count RPC returns empty (no slots taken).
  rpcMock.mockImplementation((fn: string) => {
    if (fn === "get_event_slot_counts") {
      return Promise.resolve({ data: [], error: null });
    }
    return Promise.resolve({ data: null, error: { message: "unexpected rpc: " + fn } });
  });
});

// ── Member path (skip OTP) ─────────────────────────────────────────────────

describe("member path", () => {
  function mockMemberRegisterOk() {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "get_event_slot_counts") {
        return Promise.resolve({ data: [], error: null });
      }
      if (fn === "register_event_as_member") {
        return Promise.resolve({ data: [MEMBER_ROW], error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unexpected rpc: " + fn } });
    });
  }

  it("free event: RPC ok → success step, localStorage handle, onSuccess, NO payment order", async () => {
    mockMemberRegisterOk();
    const onSuccess = vi.fn();
    renderModal({ memberSkipOtp: true, priceVnd: 0, onSuccess });

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký →" }));

    await screen.findByText("Đăng ký thành công!");
    expect(rpcMock).toHaveBeenCalledWith("register_event_as_member", {
      p_event_id: EVENT_ID,
      p_slot_id: undefined,
    });
    expect(invokeMock).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.magic_token).toBe("tok1");
    expect(stored.registration_id).toBe("r1");
  });

  it("paid event: order created → payment step with reference code folded into localStorage", async () => {
    mockMemberRegisterOk();
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        order_id: "o1",
        reference_code: "REF123",
        amount_vnd: 150000,
        player_claimed_paid: false,
        player_claimed_at: null,
        bank: BANK,
      },
      error: null,
    });
    renderModal({ memberSkipOtp: true, priceVnd: 150000 });

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký →" }));

    const qr = await screen.findByTestId("qr-step");
    expect(qr.textContent).toContain("REF123");
    expect(invokeMock).toHaveBeenCalledWith("create-payment-order", {
      body: { registration_id: "r1", magic_token: "tok1" },
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.reference_code).toBe("REF123");
  });

  it("paid event: claiming payment jumps straight to success with the reference code + no unpaid badge", async () => {
    mockMemberRegisterOk();
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        order_id: "o1",
        reference_code: "REF123",
        amount_vnd: 150000,
        player_claimed_paid: false,
        player_claimed_at: null,
        bank: BANK,
      },
      error: null,
    });
    renderModal({ memberSkipOtp: true, priceVnd: 150000, requiresPrepayment: true });

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký →" }));
    fireEvent.click(await screen.findByRole("button", { name: "mock-claim" }));

    await screen.findByText("Đăng ký thành công!");
    // Reference code card is surfaced prominently on the success step.
    expect(screen.getByText("REF123")).toBeTruthy();
    // Claimed → the amber unpaid badge must NOT render.
    expect(screen.queryByText(/chưa thanh toán/i)).toBeNull();
  });

  it("paid event: skipping payment lands on success with the unpaid badge when prepayment required", async () => {
    mockMemberRegisterOk();
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        order_id: "o1",
        reference_code: "REF123",
        amount_vnd: 150000,
        player_claimed_paid: false,
        player_claimed_at: null,
        bank: BANK,
      },
      error: null,
    });
    renderModal({ memberSkipOtp: true, priceVnd: 150000, requiresPrepayment: true });

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký →" }));
    fireEvent.click(await screen.findByRole("button", { name: "mock-skip" }));

    await screen.findByText("Đăng ký thành công!");
    expect(screen.getByText("REF123")).toBeTruthy();
  });

  it("success step: saving a recovery email calls update_profile_contact_from_magic with the magic token", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "get_event_slot_counts") {
        return Promise.resolve({ data: [], error: null });
      }
      if (fn === "register_event_as_member") {
        return Promise.resolve({ data: [MEMBER_ROW], error: null });
      }
      if (fn === "update_profile_contact_from_magic") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unexpected rpc: " + fn } });
    });
    renderModal({ memberSkipOtp: true, priceVnd: 0 });

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký →" }));
    await screen.findByText("Đăng ký thành công!");

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Lưu email/i }));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("update_profile_contact_from_magic", {
        p_magic_token: "tok1",
        p_email: "test@example.com",
      }),
    );
  });

  it("paid event: payment_not_enabled → falls back to success step, no QR", async () => {
    mockMemberRegisterOk();
    invokeMock.mockResolvedValue({
      data: { ok: true, code: "payment_not_enabled" },
      error: null,
    });
    renderModal({ memberSkipOtp: true, priceVnd: 150000 });

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký →" }));

    await screen.findByText("Đăng ký thành công!");
    expect(screen.queryByTestId("qr-step")).toBeNull();
  });

  it("RPC error 'event_full\\nCONTEXT…' → translated toast, stays on member step, nothing stored", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "get_event_slot_counts") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({
        data: null,
        error: {
          message: "event_full\nCONTEXT: PL/pgSQL function register_event_as_member",
          code: "22023",
        },
      });
    });
    const onSuccess = vi.fn();
    renderModal({ memberSkipOtp: true, priceVnd: 0, onSuccess });

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký →" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "Sự kiện đã đủ người",
        variant: "destructive",
      }),
    );
    // Still on the member step — CTA re-enabled for retry.
    expect(screen.getByRole("button", { name: "Xác nhận đăng ký →" })).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("RPC returns empty rows → treated as network error, nothing stored", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "get_event_slot_counts") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });
    const onSuccess = vi.fn();
    renderModal({ memberSkipOtp: true, priceVnd: 0, onSuccess });

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký →" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "Lỗi kết nối — vui lòng thử lại",
        variant: "destructive",
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("slot capacity: full slot is disabled with 'Đã đầy'; open slot shows remaining and registers with slot_id", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "get_event_slot_counts") {
        return Promise.resolve({
          data: [
            { slot_id: "s1", registered_count: 2 },
            { slot_id: "s2", registered_count: 1 },
          ],
          error: null,
        });
      }
      if (fn === "register_event_as_member") {
        return Promise.resolve({ data: [MEMBER_ROW], error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unexpected rpc: " + fn } });
    });
    renderModal({ memberSkipOtp: true, priceVnd: 0, slots: SLOTS });

    await screen.findByText("Đã đầy");
    expect(screen.getByText("Còn 3/4 chỗ")).toBeTruthy();
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios[0].disabled).toBe(true); // s1 full
    expect(radios[1].disabled).toBe(false);

    // No slot picked → submit disabled.
    const cta = screen.getByRole("button", { name: "Xác nhận đăng ký →" }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);

    fireEvent.click(radios[1]);
    expect(cta.disabled).toBe(false);
    fireEvent.click(cta);

    await screen.findByText("Đăng ký thành công!");
    expect(rpcMock).toHaveBeenCalledWith("register_event_as_member", {
      p_event_id: EVENT_ID,
      p_slot_id: "s2",
    });
  });
});

// ── Rendering characterization (slot metadata, success-step furniture) ─────

describe("rendering", () => {
  const RICH_SLOTS: SocialEventSlot[] = [
    {
      id: "s1",
      label: "Nhóm 3.0",
      kind: "skill",
      capacity: 8,
      court_count: 2,
      skill_level: "3.0 — 3.5",
      min_play_months: null,
      notes: "Ưu tiên hội viên",
    },
    {
      id: "s2",
      label: "Người mới",
      kind: "duration",
      capacity: 8,
      court_count: null,
      skill_level: null,
      min_play_months: 0,
      notes: null,
    },
    {
      id: "s3",
      label: "Chơi lâu",
      kind: "duration",
      capacity: 8,
      court_count: null,
      skill_level: null,
      min_play_months: 6,
      notes: null,
    },
  ];

  it("phone step renders slot metadata: skill level, newbie, min months, court count, notes", async () => {
    renderModal({ slots: RICH_SLOTS });

    await screen.findByText("Nhóm 3.0");
    expect(screen.getByText("Trình độ: 3.0 — 3.5 · 2 sân")).toBeTruthy();
    expect(screen.getByText("Người mới bắt đầu")).toBeTruthy();
    expect(screen.getByText("Đã chơi tối thiểu 6 tháng")).toBeTruthy();
    expect(screen.getByText("Ưu tiên hội viên")).toBeTruthy();
    expect(screen.getAllByText("Còn 8/8 chỗ")).toHaveLength(3);
  });

  it("success step: Zalo group button + recovery skip hides the opt-in card", async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "get_event_slot_counts") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: [MEMBER_ROW], error: null });
    });
    renderModal({
      memberSkipOtp: true,
      priceVnd: 0,
      zaloGroupUrl: "https://zalo.me/g/test",
    });

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký →" }));
    await screen.findByText("Đăng ký thành công!");

    const zalo = screen.getByRole("link", { name: "Mở nhóm Zalo" });
    expect(zalo.getAttribute("href")).toBe("https://zalo.me/g/test");
    // Save-link card carries the /dang-ky magic URL.
    expect(screen.getByText(/\/dang-ky\/tok1/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));
    expect(screen.queryByText("Email recovery (tuỳ chọn)")).toBeNull();
  });
});

// ── OTP path ───────────────────────────────────────────────────────────────

async function fillPhoneStep() {
  fireEvent.change(screen.getByLabelText("Số điện thoại"), {
    target: { value: "0912345678" },
  });
  fireEvent.change(screen.getByLabelText("Tên hiển thị"), {
    target: { value: "Nguyễn Test" },
  });
  const send = screen.getByRole("button", { name: "Gửi mã OTP" }) as HTMLButtonElement;
  await waitFor(() => expect(send.disabled).toBe(false));
  return send;
}

describe("OTP path", () => {
  it("send OTP: normalized phone + turnstile token in body → advances to OTP step", async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, channel: "sms" }, error: null });
    renderModal();

    const send = await fillPhoneStep();
    fireEvent.click(send);

    await screen.findByText("Mã OTP 6 chữ số");
    expect(invokeMock).toHaveBeenCalledWith("phone-otp-send", {
      body: {
        phone: "+84912345678",
        event_id: EVENT_ID,
        turnstile_token: "tt-token-1",
      },
    });
  });

  it("dev mode: dev_mode_code echoed on the OTP step, resend disabled during cooldown", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, channel: "dev", dev_mode_code: "424242" },
      error: null,
    });
    renderModal();

    fireEvent.click(await fillPhoneStep());

    await screen.findByText("Mã OTP 6 chữ số");
    expect(screen.getByText("424242")).toBeTruthy();
    // 60s resend cooldown started by the successful send.
    const resend = screen.getByRole("button", { name: "Gửi lại sau 60s" }) as HTMLButtonElement;
    expect(resend.disabled).toBe(true);
  });

  it("zalo channel: zalo hint + SMS fallback link rendered (disabled during cooldown)", async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, channel: "zalo" }, error: null });
    renderModal();

    fireEvent.click(await fillPhoneStep());

    await screen.findByText("Mã OTP 6 chữ số");
    expect(screen.getByText(/Đã gửi mã qua Zalo/)).toBeTruthy();
    const smsLink = screen.getByRole("button", {
      name: "Không nhận được Zalo? Gửi lại qua SMS →",
    }) as HTMLButtonElement;
    expect(smsLink.disabled).toBe(true);
  });

  it("send OTP non-2xx: code read from response body → translated toast, stays on phone step", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(JSON.stringify({ code: "too_many_otps" })),
      },
    });
    renderModal();

    const send = await fillPhoneStep();
    fireEvent.click(send);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "Bạn đã yêu cầu OTP quá nhiều lần — thử lại sau 15 phút",
        variant: "destructive",
      }),
    );
    expect(screen.getByLabelText("Số điện thoại")).toBeTruthy();
  });

  it("verify ok (free event): body carries code + trimmed name, null level, no slot_id → success step", async () => {
    invokeMock.mockImplementation((fn: string) => {
      if (fn === "phone-otp-send") {
        return Promise.resolve({ data: { ok: true, channel: "sms" }, error: null });
      }
      if (fn === "phone-otp-verify") {
        return Promise.resolve({ data: VERIFY_OK, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unexpected fn: " + fn } });
    });
    renderModal();

    fireEvent.click(await fillPhoneStep());
    await screen.findByText("Mã OTP 6 chữ số");

    fireEvent.change(screen.getByLabelText("otp-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký" }));

    await screen.findByText("Đăng ký thành công!");
    expect(invokeMock).toHaveBeenCalledWith("phone-otp-verify", {
      body: {
        phone: "+84912345678",
        event_id: EVENT_ID,
        code: "123456",
        display_name: "Nguyễn Test",
        self_rated_level: null,
        slot_id: undefined,
      },
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.magic_token).toBe("tok1");
  });

  it("send OTP network throw → generic network-error toast, stays on phone step", async () => {
    invokeMock.mockRejectedValue(new TypeError("fetch failed"));
    renderModal();

    fireEvent.click(await fillPhoneStep());

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "Lỗi kết nối — vui lòng thử lại",
        variant: "destructive",
      }),
    );
    expect(screen.getByLabelText("Số điện thoại")).toBeTruthy();
  });

  it("send OTP 200 body carrying a code field → translated toast, no OTP step", async () => {
    invokeMock.mockResolvedValue({
      data: { code: "daily_budget_exceeded" },
      error: null,
    });
    renderModal();

    fireEvent.click(await fillPhoneStep());

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "Hệ thống đang tạm dừng gửi tin tự động. Vui lòng liên hệ ban tổ chức.",
        variant: "destructive",
      }),
    );
    expect(screen.queryByText("Mã OTP 6 chữ số")).toBeNull();
  });

  it("verify 200 without ok:true → network-error toast, registration NOT stored", async () => {
    invokeMock.mockImplementation((fn: string) => {
      if (fn === "phone-otp-send") {
        return Promise.resolve({ data: { ok: true, channel: "sms" }, error: null });
      }
      return Promise.resolve({ data: { ok: false }, error: null });
    });
    renderModal();

    fireEvent.click(await fillPhoneStep());
    await screen.findByText("Mã OTP 6 chữ số");
    fireEvent.change(screen.getByLabelText("otp-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "Lỗi kết nối — vui lòng thử lại",
        variant: "destructive",
      }),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("verify wrong code: otp_mismatch → 'Mã OTP không đúng' toast, stays on OTP step", async () => {
    invokeMock.mockImplementation((fn: string) => {
      if (fn === "phone-otp-send") {
        return Promise.resolve({ data: { ok: true, channel: "sms" }, error: null });
      }
      return Promise.resolve({
        data: null,
        error: {
          name: "FunctionsHttpError",
          message: "Edge Function returned a non-2xx status code",
          context: new Response(JSON.stringify({ code: "otp_mismatch" })),
        },
      });
    });
    renderModal();

    fireEvent.click(await fillPhoneStep());
    await screen.findByText("Mã OTP 6 chữ số");

    fireEvent.change(screen.getByLabelText("otp-input"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "Mã OTP không đúng",
        variant: "destructive",
      }),
    );
    expect(screen.getByLabelText("otp-input")).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("verify ok (paid event): create-payment-order failure → success step fallback (registration NOT lost)", async () => {
    invokeMock.mockImplementation((fn: string) => {
      if (fn === "phone-otp-send") {
        return Promise.resolve({ data: { ok: true, channel: "sms" }, error: null });
      }
      if (fn === "phone-otp-verify") {
        return Promise.resolve({ data: VERIFY_OK, error: null });
      }
      // create-payment-order hard-fails
      return Promise.resolve({ data: null, error: { message: "boom" } });
    });
    renderModal({ priceVnd: 200000 });

    fireEvent.click(await fillPhoneStep());
    await screen.findByText("Mã OTP 6 chữ số");
    fireEvent.change(screen.getByLabelText("otp-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng ký" }));

    await screen.findByText("Đăng ký thành công!");
    expect(screen.queryByTestId("qr-step")).toBeNull();
    // Registration handle survived the payment failure.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.magic_token).toBe("tok1");
  });
});
