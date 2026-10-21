/** @vitest-environment jsdom */
/**
 * The mobile filter sheet has to show the buyer what they just tapped.
 *
 * P2b.7 found it did not. `FilterSheet` held its draft in a `useRef` and
 * passed `draftRef.current` as the `value` of controlled inputs, so tapping
 * "Đã qua sử dụng" mutated the ref, re-rendered nothing, and React put the
 * radio straight back to unchecked. Áp dụng committed the right filter — the
 * draft was correct — but on a phone the control looked broken, and the
 * obvious reaction to a control that ignores you is to tap it again.
 *
 * Nothing caught it: the unit tests cover the query arguments, and the browser
 * gate asserted the URL after Áp dụng, which was always right. This asserts
 * the thing the buyer can actually see.
 */
import { afterEach, describe, expect, it, vi, beforeAll } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DEFAULT_FILTERS, FilterSheet } from "../CatalogResults";

afterEach(cleanup);

// jsdom has no modal dialog. Both are no-ops here; the assertions are about
// the controls inside, not about the platform's focus trap.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() { this.open = false; };
  }
});

const openSheet = () => {
  const onApply = vi.fn();
  render(
    <FilterSheet open value={DEFAULT_FILTERS} onApply={onApply} onClose={vi.fn()} />,
  );
  return { onApply, sheet: screen.getByRole("dialog", { hidden: true }) };
};

describe("FilterSheet", () => {
  it("shows the condition the buyer just chose", () => {
    const { sheet } = openSheet();
    const used = within(sheet).getByLabelText("Đã qua sử dụng") as HTMLInputElement;
    expect(used.checked).toBe(false);

    fireEvent.click(used);

    expect(used.checked, "tapping a filter must look like it did something").toBe(true);
    const all = within(sheet).getByLabelText("Tất cả") as HTMLInputElement;
    expect(all.checked, "choosing one option must clear the other").toBe(false);
  });

  it("shows the stock checkbox as ticked", () => {
    const { sheet } = openSheet();
    const stock = within(sheet).getByLabelText(/Chỉ hiện sản phẩm còn hàng/) as HTMLInputElement;
    fireEvent.click(stock);
    expect(stock.checked).toBe(true);
  });

  it("shows the sort the buyer chose", () => {
    const { sheet } = openSheet();
    const cheapest = within(sheet).getByLabelText("Giá thấp trước") as HTMLInputElement;
    fireEvent.click(cheapest);
    expect(cheapest.checked).toBe(true);
  });

  it("still commits only on Áp dụng, and commits what was chosen", () => {
    // The half that already worked, kept: edits must not reach the URL on tap.
    const { onApply, sheet } = openSheet();
    fireEvent.click(within(sheet).getByLabelText("Đã qua sử dụng"));
    fireEvent.click(within(sheet).getByLabelText(/Chỉ hiện sản phẩm còn hàng/));
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(onApply).toHaveBeenCalledWith({ condition: "used", inStockOnly: true, sort: "recent" });
  });

  it("does not carry a cancelled draft into the next opening", () => {
    // Huỷ leaves the draft dirty in a ref-based implementation; reopening then
    // shows a selection the buyer never applied.
    const onApply = vi.fn();
    const { rerender } = render(
      <FilterSheet open value={DEFAULT_FILTERS} onApply={onApply} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText("Đã qua sử dụng"));
    rerender(<FilterSheet open={false} value={DEFAULT_FILTERS} onApply={onApply} onClose={vi.fn()} />);
    rerender(<FilterSheet open value={DEFAULT_FILTERS} onApply={onApply} onClose={vi.fn()} />);

    expect((screen.getByLabelText("Tất cả") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Đã qua sử dụng") as HTMLInputElement).checked).toBe(false);
  });
});
