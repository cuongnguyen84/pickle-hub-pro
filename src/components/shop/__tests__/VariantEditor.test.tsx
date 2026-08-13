/** @vitest-environment jsdom */
/**
 * The variant matrix, driven through the screen a seller actually uses.
 *
 * `src/lib/shop/__tests__/variantMatrix.test.ts` already pins the pure
 * functions. Nothing here re-tests them; what is tested here is the wiring
 * that decides whether those functions ever run on the right input — the part
 * that has no unit test and is where this editor loses somebody's work:
 *
 *   · a row is its combination, not its position. Reordering the values of a
 *     group moves rows on screen; every SKU, price and stock count has to
 *     arrive with its own combination, not with its old index.
 *   · anything that drops combinations names them — with SKU and stock —
 *     BEFORE it happens, and Giữ như cũ has to leave the table byte-identical.
 *   · a duplicate SKU marks the later row only, and blocks the save. Marking
 *     both leaves the seller with no way to know which one to change.
 *   · bulk apply reports the number it really changed and stays undoable.
 *   · desktop table and mobile cards are two renderings of ONE state. A fix
 *     applied to one and not the other is invisible until a phone reports it.
 *   · saving says "Đã lưu" only after the server said so.
 *
 * The editor is rendered with its real dependencies (`variantMatrix`,
 * `errors`, `productState`); only `onSave` is a double, because it is the
 * boundary this component owns.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import VariantEditor from "../VariantEditor";
import type { OptionGroup, VariantRow } from "@/lib/shop/variantMatrix";

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** Two groups, four combinations, every cell distinct so a row that arrives
 *  with the wrong data is visible rather than plausible. */
const groups = (): OptionGroup[] => [
  { name: "Màu sắc", values: ["Trắng", "Đen"] },
  { name: "Size", values: ["39", "40"] },
];

const rows = (): VariantRow[] => [
  { id: "v1", optionValues: { "Màu sắc": "Trắng", Size: "39" }, priceVnd: "1000000", stockOnHand: "3", sku: "W39" },
  { id: "v2", optionValues: { "Màu sắc": "Trắng", Size: "40" }, priceVnd: "1100000", stockOnHand: "4", sku: "W40" },
  { id: "v3", optionValues: { "Màu sắc": "Đen", Size: "39" }, priceVnd: "1200000", stockOnHand: "5", sku: "B39" },
  { id: "v4", optionValues: { "Màu sắc": "Đen", Size: "40" }, priceVnd: "1300000", stockOnHand: "6", sku: "B40" },
];

const onSave = vi.fn();

const mount = (over: Partial<Parameters<typeof VariantEditor>[0]> = {}) =>
  render(
    <VariantEditor
      disabled={false}
      initialGroups={groups()}
      initialRows={rows()}
      onSave={onSave}
      {...over}
    />,
  );

// ─── DOM helpers ────────────────────────────────────────────────────────────
//
// Every row is rendered twice — a table for desktop, a card for mobile — with
// the same accessible names. Index 0 is the table, index 1 the card; that
// duplication is itself an invariant (see "one state, two renderings").

type Field = "Mã hàng" | "Giá" | "Tồn kho";

const cell = (field: Field, combo: string, which = 0) =>
  screen.getAllByLabelText(`${field} ${combo}`)[which] as HTMLInputElement;

const type = (field: Field, combo: string, value: string, which = 0) =>
  fireEvent.change(cell(field, combo, which), { target: { value } });

/** The whole table as plain data, read out of the mobile cards (one per row,
 *  in row order). Used to assert a cancelled change left nothing behind. */
const matrix = () =>
  Array.from(document.querySelectorAll(".tl-shop-varcard")).map((card) => ({
    combo: card.querySelector("p")?.textContent ?? "",
    cells: Array.from(card.querySelectorAll("input")).map((i) => (i as HTMLInputElement).value),
  }));

const valuesInput = (index: number) =>
  screen.getAllByLabelText("Giá trị, cách nhau bằng dấu phẩy")[index] as HTMLInputElement;

/** The values field is uncontrolled and commits on blur — the seller types a
 *  whole comma-separated line before anything is rebuilt. */
const setValues = (index: number, line: string) =>
  fireEvent.blur(valuesInput(index), { target: { value: line } });

const saveButton = () => screen.getByRole("button", { name: /Lưu bảng phiên bản|Đang lưu/ });

beforeEach(() => {
  onSave.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

// ─── 1. A row is its combination ────────────────────────────────────────────

describe("a row is identified by its combination, never by where it sits", () => {
  it("reordering the values of a group moves rows, not their data", () => {
    mount();
    expect(matrix().map((r) => r.combo)).toEqual(["Trắng · 39", "Trắng · 40", "Đen · 39", "Đen · 40"]);

    setValues(0, "Đen, Trắng");

    // Same four combinations, now in the seller's order — and each one still
    // carries its own SKU, price and stock. An implementation keyed on the
    // array index would hand Đen · 39 the white shoe's stock count.
    expect(matrix()).toEqual([
      { combo: "Đen · 39", cells: ["B39", "1200000", "5"] },
      { combo: "Đen · 40", cells: ["B40", "1300000", "6"] },
      { combo: "Trắng · 39", cells: ["W39", "1000000", "3"] },
      { combo: "Trắng · 40", cells: ["W40", "1100000", "4"] },
    ]);
  });

  it("adding a value adds exactly the new combinations and leaves the rest alone", () => {
    mount();

    setValues(1, "39, 40, 41");

    const after = matrix();
    expect(after).toHaveLength(6);
    expect(after.map((r) => r.combo)).toEqual([
      "Trắng · 39", "Trắng · 40", "Trắng · 41", "Đen · 39", "Đen · 40", "Đen · 41",
    ]);
    // A new size inherits a price to confirm, and NO stock: nobody has bought
    // 41s yet. A pre-filled count here is saved as a stock correction and puts
    // shoes that do not exist in front of a buyer.
    expect(after[2].cells).toEqual(["", "1000000", ""]);
    expect(after[5].cells).toEqual(["", "1000000", ""]);
    // The four that existed are untouched.
    expect(cell("Mã hàng", "Đen · 40").value).toBe("B40");
    expect(cell("Tồn kho", "Đen · 40").value).toBe("6");
  });

  it("turning the matrix on for a simple product seeds the new rows from its price", () => {
    mount({
      initialGroups: [],
      initialRows: [{ id: "v0", optionValues: {}, priceVnd: "990000", stockOnHand: "7", sku: "SOLO" }],
    });
    expect(screen.getByText(/Đang là sản phẩm đơn/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/Sản phẩm có nhiều phiên bản/));
    // Naming the group before typing its values is an unavoidable intermediate
    // state, and the single product's row is the only place its price lives.
    fireEvent.change(screen.getByLabelText("Tên nhóm 1"), { target: { value: "Màu sắc" } });
    setValues(0, "Trắng, Đen");

    // Both combinations start at the single product's price rather than blank —
    // the difference between confirming a number and retyping it. The stock
    // does NOT come along: 7 pairs do not become 7 white and 7 black.
    expect(matrix()).toEqual([
      { combo: "Trắng", cells: ["", "990000", ""] },
      { combo: "Đen", cells: ["", "990000", ""] },
    ]);
  });

  it("refuses a duplicate value that only differs by case or spacing", () => {
    mount();
    setValues(0, "Trắng,  trắng ");

    expect(screen.getByText('Đã có giá trị "trắng"')).toBeTruthy();
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    // Rejected, not half-applied: the four real combinations are still there.
    expect(matrix().map((r) => r.combo)).toEqual(["Trắng · 39", "Trắng · 40", "Đen · 39", "Đen · 40"]);
  });

  it("survives a typo on the way to a valid group", () => {
    mount();

    // A seller retyping "Trắng, Đen" passes through states that are not valid
    // yet — one value, then a duplicate — before landing on a good one. None
    // of those are a decision to throw away the black shoes.
    setValues(0, "Trắng, Trắng");
    setValues(0, "Trắng, Đe");
    setValues(0, "Trắng, Đen");

    expect(matrix()).toEqual([
      { combo: "Trắng · 39", cells: ["W39", "1000000", "3"] },
      { combo: "Trắng · 40", cells: ["W40", "1100000", "4"] },
      { combo: "Đen · 39", cells: ["B39", "1200000", "5"] },
      { combo: "Đen · 40", cells: ["B40", "1300000", "6"] },
    ]);
  });

  it("stops at three option groups", () => {
    mount();
    expect(screen.getByRole("button", { name: /Thêm nhóm/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Thêm nhóm/ }));

    expect(screen.getAllByLabelText(/^Tên nhóm/)).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Thêm nhóm/ })).toBeNull();
    // Adding an empty third group must not have rebuilt anything.
    expect(cell("Mã hàng", "Trắng · 39").value).toBe("W39");
  });

  it("stops at a hundred combinations and says how many were asked for", () => {
    mount({
      initialGroups: [{ name: "Size", values: ["39", "40"] }],
      initialRows: [
        { id: "v1", optionValues: { Size: "39" }, priceVnd: "1", stockOnHand: "", sku: "" },
        { id: "v2", optionValues: { Size: "40" }, priceVnd: "1", stockOnHand: "", sku: "" },
      ],
    });

    setValues(0, Array.from({ length: 101 }, (_, i) => String(i + 1)).join(", "));

    expect(screen.getByRole("alert").textContent).toContain("tạo ra 101");
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("never writes through to the arrays it was handed", () => {
    const frozenGroups = groups().map((g) => Object.freeze({ ...g, values: Object.freeze(g.values) }));
    const frozenRows = rows().map((r) => Object.freeze({ ...r, optionValues: Object.freeze(r.optionValues) }));
    mount({
      initialGroups: Object.freeze(frozenGroups) as OptionGroup[],
      initialRows: Object.freeze(frozenRows) as VariantRow[],
    });

    // Everything that rebuilds or rewrites rows, on frozen input. A mutation
    // would throw here (module code is strict), and the value check below
    // catches a non-throwing shallow copy that shares nested objects.
    type("Giá", "Trắng · 39", "9999");
    fireEvent.change(screen.getByLabelText("Giá trị mới"), { target: { value: "500000" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp cho tất cả" }));
    setValues(1, "39, 40, 41");

    expect(frozenRows[0].priceVnd).toBe("1000000");
    expect(frozenRows[0].optionValues).toEqual({ "Màu sắc": "Trắng", Size: "39" });
    expect(frozenGroups[1].values).toEqual(["39", "40"]);
  });
});

// ─── 2. Losing combinations ─────────────────────────────────────────────────

describe("nothing disappears without being named first", () => {
  it("names every combination a removed value takes with it, with SKU and stock", () => {
    mount();

    setValues(0, "Trắng");

    const notice = screen.getByRole("alert");
    expect(notice.textContent).toContain("Thay đổi này bỏ 2 phiên bản");
    // Named by combination, not "2 rows" — and with the two things that let a
    // seller recognise them on a shelf.
    expect(notice.textContent).toContain("Đen · 39 · B39 · còn 5");
    expect(notice.textContent).toContain("Đen · 40 · B40 · còn 6");
    // Still just a warning: the table has not been rebuilt yet.
    expect(matrix()).toHaveLength(4);
  });

  it("Giữ như cũ leaves the table byte-identical", () => {
    mount();
    const before = matrix();

    setValues(0, "Trắng");
    fireEvent.click(screen.getByRole("button", { name: "Giữ như cũ" }));

    expect(screen.queryByText(/Thay đổi này bỏ/)).toBeNull();
    expect(matrix()).toEqual(before);
  });

  it("Vẫn đổi drops exactly the combinations it named and keeps the others whole", () => {
    mount();

    setValues(0, "Trắng");
    fireEvent.click(screen.getByRole("button", { name: "Vẫn đổi" }));

    expect(matrix()).toEqual([
      { combo: "Trắng · 39", cells: ["W39", "1000000", "3"] },
      { combo: "Trắng · 40", cells: ["W40", "1100000", "4"] },
    ]);
  });

  it("warns the same way when a whole group is deleted", () => {
    mount();

    fireEvent.click(screen.getAllByRole("button", { name: /Xoá nhóm/ })[1]);

    expect(screen.getByRole("alert").textContent).toContain("Thay đổi này bỏ 4 phiên bản");
    expect(matrix()).toHaveLength(4);
  });

  it("asks before a rename drops every combination under the old name", () => {
    mount();

    fireEvent.change(screen.getByLabelText("Tên nhóm 1"), { target: { value: "Màu" } });
    fireEvent.blur(screen.getByLabelText("Tên nhóm 1"));

    // Renaming a group changes every option key under it, so it is destructive
    // for the same reason removing a value is — and must say so with the full
    // name the seller typed, not one keystroke of it.
    expect(screen.getByRole("alert").textContent).toContain("Thay đổi này bỏ 4 phiên bản");
    fireEvent.click(screen.getByRole("button", { name: "Vẫn đổi" }));
    expect(matrix().map((r) => r.combo)).toEqual(["Trắng · 39", "Trắng · 40", "Đen · 39", "Đen · 40"]);
    expect((screen.getByLabelText("Tên nhóm 1") as HTMLInputElement).value).toBe("Màu");
  });
});

// ─── 3. Collapsing back to one variant ──────────────────────────────────────

describe("turning the matrix off", () => {
  it("makes the seller pick which variant survives, and sends that one", async () => {
    mount();

    fireEvent.click(screen.getByLabelText(/Sản phẩm có nhiều phiên bản/));

    const keep = screen.getByLabelText("Phiên bản giữ lại") as HTMLSelectElement;
    // Every option is identifiable by the three things printed on a label.
    expect(Array.from(keep.options).map((o) => o.textContent)).toEqual([
      "Trắng · 39 · 1.000.000₫ · W39",
      "Trắng · 40 · 1.100.000₫ · W40",
      "Đen · 39 · 1.200.000₫ · B39",
      "Đen · 40 · 1.300.000₫ · B40",
    ]);
    expect(screen.getByText(/3 phiên bản còn lại sẽ ngừng bán/)).toBeTruthy();

    fireEvent.change(keep, { target: { value: "v3" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // The seller's choice, not initialRows[0], and no groups.
    expect(onSave.mock.calls[0][0]).toMatchObject({ groups: [], keepVariantId: "v3" });
  });

  it("does not send a keep id while the matrix is still on", async () => {
    mount();
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0];
    expect(payload.keepVariantId).toBeNull();
    expect(payload.groups).toEqual(groups());
    expect(payload.rows).toHaveLength(4);
  });
});

// ─── 4. Editing cells ───────────────────────────────────────────────────────

describe("editing a cell", () => {
  it("marks only the later of two rows sharing a SKU, and names the row it hit", () => {
    mount();

    type("Mã hàng", "Đen · 39", " w39 ");

    // Trimmed and case-folded before comparing, because the database does.
    expect(cell("Mã hàng", "Đen · 39").getAttribute("aria-invalid")).toBe("true");
    expect(cell("Mã hàng", "Trắng · 39").getAttribute("aria-invalid")).toBe("false");
    expect(screen.getAllByRole("alert")[0].textContent).toContain("Trùng mã hàng với dòng 1");
  });

  it("blocks the save while a duplicate stands, and releases it once fixed", () => {
    mount();

    type("Mã hàng", "Đen · 39", "W39");
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Còn ô chưa hợp lệ")).toBeTruthy();

    type("Mã hàng", "Đen · 39", "B39");
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("Còn ô chưa hợp lệ")).toBeNull();
  });

  it("changes one row and no other", () => {
    mount();
    const before = matrix();

    type("Giá", "Trắng · 40", "1234567");

    const after = matrix();
    expect(after[1].cells).toEqual(["W40", "1234567", "4"]);
    expect(after.filter((_, i) => i !== 1)).toEqual(before.filter((_, i) => i !== 1));
  });

  it("keeps a stock of zero meaning sold out, not meaning untracked", async () => {
    mount();

    type("Tồn kho", "Trắng · 39", "0");
    expect(cell("Tồn kho", "Trắng · 39").value).toBe("0");
    expect(cell("Tồn kho", "Trắng · 39").getAttribute("aria-invalid")).toBe("false");

    fireEvent.click(saveButton());
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    // "0" and "" are different answers — one is sold out, the other is not
    // counted — and only the payload can tell them apart.
    expect(onSave.mock.calls[0][0].rows[0].stockOnHand).toBe("0");
  });

  it("refuses a price that is not a plain integer", () => {
    mount();

    type("Giá", "Trắng · 39", "1.000.000");

    expect(cell("Giá", "Trắng · 39").getAttribute("aria-invalid")).toBe("true");
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });
});

// ─── 5. Bulk ────────────────────────────────────────────────────────────────

describe("setting a value on every row at once", () => {
  const bulk = (value: string) => {
    fireEvent.change(screen.getByLabelText("Giá trị mới"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Áp cho tất cả" }));
  };

  it("reports the number it really changed, not the number of rows", () => {
    mount();

    bulk("1200000");

    // v3 was already 1200000. Claiming four would be a lie the seller checks.
    expect(screen.getByText(/Đã đổi 3 phiên bản/)).toBeTruthy();
    expect(matrix().map((r) => r.cells[1])).toEqual(["1200000", "1200000", "1200000", "1200000"]);
  });

  it("says plainly when it changed nothing", () => {
    mount();

    bulk("1000000");
    expect(screen.getByText(/Đã đổi 3 phiên bản/)).toBeTruthy();
    // Same value again: four rows, nothing to do. Silence here reads as a
    // failed click; "đã đổi 4" reads as a change that never happened.
    bulk("1000000");

    expect(screen.getByText(/Không phiên bản nào đổi/)).toBeTruthy();
  });

  it("puts the whole table back exactly as it was", () => {
    mount();
    const before = matrix();

    bulk("500000");
    expect(matrix()).not.toEqual(before);
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));

    expect(matrix()).toEqual(before);
  });

  it("offers no undo before anything has been applied", () => {
    mount();
    expect(screen.queryByRole("button", { name: "Hoàn tác" })).toBeNull();
  });

  it("applies to stock without touching price", () => {
    mount();
    fireEvent.change(screen.getByLabelText("Đổi ô nào"), { target: { value: "stockOnHand" } });
    bulk("10");

    expect(matrix().map((r) => r.cells)).toEqual([
      ["W39", "1000000", "10"],
      ["W40", "1100000", "10"],
      ["B39", "1200000", "10"],
      ["B40", "1300000", "10"],
    ]);
  });
});

// ─── 6. One state, two renderings ───────────────────────────────────────────

describe("the table and the phone cards are one state", () => {
  it("a value typed on the phone card is the same value the table shows", () => {
    mount();

    type("Mã hàng", "Trắng · 39", "PHONE-1", 1);

    expect(cell("Mã hàng", "Trắng · 39", 0).value).toBe("PHONE-1");
  });

  it("a duplicate typed on the phone card is marked on both", () => {
    mount();

    type("Mã hàng", "Đen · 40", "W39", 1);

    expect(cell("Mã hàng", "Đen · 40", 0).getAttribute("aria-invalid")).toBe("true");
    expect(cell("Mã hàng", "Đen · 40", 1).getAttribute("aria-invalid")).toBe("true");
  });

  it("saves the same payload whichever rendering was typed into", async () => {
    mount();
    type("Giá", "Đen · 40", "1440000", 1);
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].rows[3]).toMatchObject({ id: "v4", priceVnd: "1440000", sku: "B40" });
  });
});

// ─── 7. Saving ──────────────────────────────────────────────────────────────

describe("saving", () => {
  it("says Đã lưu only after the server has answered", async () => {
    let release: () => void = () => {};
    onSave.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    mount();

    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText("Đang lưu…")).toBeTruthy());
    expect(screen.queryByText("Đã lưu")).toBeNull();

    release();
    await waitFor(() => expect(screen.getByText("Đã lưu")).toBeTruthy());
  });

  it("keeps every cell on screen when the server refuses", async () => {
    onSave.mockRejectedValue({ code: "PT409" });
    mount();
    type("Giá", "Trắng · 39", "1500000");
    const before = matrix();

    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText("Chưa lưu được")).toBeTruthy());
    // The seller's typing is the only copy of this data. A screen that resets
    // on a conflict destroys it.
    expect(matrix()).toEqual(before);
    expect(screen.getByRole("alert").textContent).toContain("Bản ghi vừa được cập nhật ở nơi khác");
  });

  it("does not retry on its own — the retry is a button", async () => {
    onSave.mockRejectedValue({ code: "PT409" });
    mount();
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText("Chưa lưu được")).toBeTruthy());
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });

  it("shows an unrecognised failure as something to retry, never as Postgres", async () => {
    onSave.mockRejectedValue(new Error('null value in column "price_vnd" violates not-null'));
    mount();
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText("Chưa lưu được")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("Không lưu được");
    expect(document.body.textContent).not.toContain("price_vnd");
  });

  it("cannot be saved at all while a cell is invalid", () => {
    mount();
    type("Giá", "Trắng · 39", "");
    fireEvent.click(saveButton());

    expect(onSave).not.toHaveBeenCalled();
  });
});

// ─── 8. While the product is locked ─────────────────────────────────────────

describe("while the product is waiting for review", () => {
  it("shows the matrix read-only, with no save and no bulk", () => {
    mount({ disabled: true });

    expect(screen.queryByRole("button", { name: /Lưu bảng phiên bản/ })).toBeNull();
    expect(screen.queryByLabelText("Giá trị mới")).toBeNull();
    expect(cell("Giá", "Trắng · 39").disabled).toBe(true);
    expect((screen.getByLabelText("Tên nhóm 1") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /Xoá nhóm/ })).toBeNull();
    // Read-only, not hidden: the seller can still check what is under review.
    expect(cell("Mã hàng", "Đen · 40").value).toBe("B40");
  });
});
