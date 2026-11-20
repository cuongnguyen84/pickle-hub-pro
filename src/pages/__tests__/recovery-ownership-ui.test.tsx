// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { en } from "@/i18n/en";
import RecoveryRegistration from "../RecoveryRegistration";
const state = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/i18n", () => ({ useI18n: () => ({ t: en, language: "en" }) }));
vi.mock("@/hooks/useNoindex", () => ({ useNoindex: () => {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: state.invoke } } }));
vi.mock("@/components/layout/TheLineLayout", () => ({ TheLineLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/registration/TurnstileWidget", () => ({ TurnstileWidget: ({ onVerify }: { onVerify: (token: string) => void }) => <button onClick={() => onVerify("test-solve")}>Solve test CAPTCHA</button> }));
afterEach(() => { cleanup(); state.invoke.mockReset(); });
it("completes CAPTCHA and shows conditional channel/organizer guidance without exposing credentials", async () => {
  state.invoke.mockResolvedValueOnce({ data: { ok: false, code: "captcha_required" } }).mockResolvedValueOnce({ data: { ok: true, channel: "registered_channel", magic_token: "must-not-render", recovery_url: "/dang-ky/must-not-render" } });
  render(<MemoryRouter><RecoveryRegistration /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(en.socialEvents.recovery.phoneLabel), { target: { value: "0901234567" } });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(en.socialEvents.recovery.submit) }));
  fireEvent.click(await screen.findByRole("button", { name: "Solve test CAPTCHA" }));
  fireEvent.click(screen.getByRole("button", { name: en.socialEvents.recovery.captchaSubmit }));
  const status = await screen.findByRole("status");
  expect(status.textContent).toContain("If the registration has a verified recovery channel");
  expect(status.textContent).toContain("contact the organizer to verify ownership");
  expect(document.body.textContent).not.toContain("must-not-render");
  expect(document.querySelector('a[href*="/dang-ky/"]')).toBeNull();
  expect(state.invoke.mock.calls[1][1].body.captcha_token).toBe("test-solve");
});
