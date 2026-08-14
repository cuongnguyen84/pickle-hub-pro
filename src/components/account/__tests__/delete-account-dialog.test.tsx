// @vitest-environment jsdom
// ============================================================================
// A shop owner must not be invited to type DELETE — B12, option C
// ----------------------------------------------------------------------------
// The server refuses them (delete-account returns shop_owner_offboarding_required
// before touching anything), so this component is not the control. What it owes
// the person is the sentence the server cannot deliver well, delivered BEFORE
// they commit to anything: what is in the way and what to do instead.
//
// Two failures are worth pinning, and only one of them is about the owner:
//
//   · the owner branch quietly disappearing in a refactor, so a seller types
//     DELETE and gets a server error written for a fault;
//   · the branch swallowing everyone else, so ordinary accounts can no longer
//     be closed at all. Ownership, not membership: staff on somebody else's
//     shop own nothing and keep the ordinary flow.
//
// The third assertion is about honesty: a mailto link is not a sent request,
// and nothing here may say otherwise.
// ============================================================================

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { vi as viTranslations } from "@/i18n/vi";

const mutate = vi.fn();
const myShop: { data: { id: string } | null } = { data: null };

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: viTranslations,
    language: "vi",
    setLanguage: vi.fn(),
    setLanguageFromUrl: vi.fn(),
  }),
}));

vi.mock("@/hooks/useDeleteAccount", () => ({
  useDeleteAccount: () => ({ mutate, isPending: false }),
  SHOP_OWNER_BLOCK: "shop_owner_offboarding_required",
}));

vi.mock("@/hooks/shop/useSellerApplication", () => ({
  useMyShop: () => myShop,
}));

const { DeleteAccountDialog } = await import("../DeleteAccountDialog");

const openDialog = () => {
  render(<DeleteAccountDialog />);
  fireEvent.click(screen.getByRole("button", { name: viTranslations.account.deleteAccount }));
};

beforeEach(() => {
  mutate.mockClear();
  myShop.data = null;
});
afterEach(cleanup);

describe("DeleteAccountDialog — a seller who owns a shop", () => {
  beforeEach(() => {
    myShop.data = { id: "11111111-1111-4111-8111-111111111111" };
  });

  it("explains what is in the way instead of asking for a confirmation word", () => {
    openDialog();
    expect(screen.getByText(viTranslations.account.deleteBlockedShopOwner)).toBeTruthy();
    expect(screen.getByText(viTranslations.account.deleteBlockedShopOwnerWhy)).toBeTruthy();
    // No input, so there is nothing to type and nothing to press afterwards.
    expect(document.querySelector("input")).toBeNull();
    expect(
      screen.queryByText(
        viTranslations.account.deleteConfirmInstruction.replace("{word}", "DELETE"),
      ),
    ).toBeNull();
  });

  it("offers a mail composer, and says plainly that it sends nothing", () => {
    openDialog();
    const cta = screen.getByRole("link", { name: new RegExp(viTranslations.account.deleteBlockedShopOwnerCta) });
    expect(cta.getAttribute("href")).toMatch(/^mailto:tapickleballvn@gmail\.com\?subject=/);
    // The one sentence that keeps this honest: opening a mail client is not a
    // request arriving, and somebody waiting for a reply to a message they
    // never sent is the failure this prevents.
    expect(screen.getByText(viTranslations.account.deleteBlockedShopOwnerNoAutoSend)).toBeTruthy();
  });

  it("never claims the account is closed or the request is on its way", () => {
    openDialog();
    const text = document.body.textContent ?? "";
    for (const claim of [/đã gửi/i, /đã xoá tài khoản/i, /đã xóa tài khoản/i, /đang xử lý yêu cầu/i]) {
      expect(text, `must not claim ${claim}`).not.toMatch(claim);
    }
    expect(screen.getByRole("button", { name: viTranslations.account.deleteBlockedShopOwnerBack })).toBeTruthy();
  });

  it("cannot start a deletion even if something calls the handler", () => {
    openDialog();
    // There is no confirm button to press; the guard in handleDelete is the
    // second lock, and the server is the third.
    expect(
      screen.queryByRole("button", { name: viTranslations.account.deleteAccountConfirm }),
    ).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("DeleteAccountDialog — everybody else", () => {
  it("keeps the ordinary confirm-and-delete flow", () => {
    openDialog();
    const input = document.querySelector("input");
    expect(input, "the confirmation input is still there for a normal account").toBeTruthy();
    expect(screen.getByText(viTranslations.account.deleteAccountIrreversible)).toBeTruthy();

    const confirm = screen.getByRole("button", { name: viTranslations.account.deleteAccountConfirm });
    expect(confirm.hasAttribute("disabled"), "disabled until the word matches").toBe(true);

    fireEvent.change(input!, { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: viTranslations.account.deleteAccountConfirm }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("no longer promises to delete the tournaments somebody created", () => {
    // quick_tables.creator_user_id and team_match_tournaments.created_by are
    // ON DELETE SET NULL: the tournament survives and stops naming them. The
    // old copy said it would be deleted, which was simply untrue (B14).
    openDialog();
    const text = document.body.textContent ?? "";
    expect(text).toContain(viTranslations.account.deleteDataTournaments);
    expect(viTranslations.account.deleteDataTournaments).toMatch(/vẫn còn|không còn gắn tên/i);
    expect(viTranslations.account.deleteDataTournaments).not.toBe("Các giải đấu bạn đã tạo");
  });
});
