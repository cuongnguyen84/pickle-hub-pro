// ============================================================================
// The variant matrix editor (P2a step 5).
// ----------------------------------------------------------------------------
// Lazily loaded by SellerProductForm, so a seller editing a simple product
// never downloads it.
//
// Rules the screen keeps, each of which is a way this kind of editor usually
// loses somebody's work:
//   * a row is identified by its combination, never by where it sits. Adding a
//     size adds one row; reordering the groups moves columns and nothing else.
//   * removing a value says which combinations go with it, by name, before it
//     happens — those are prices and stock counts disappearing.
//   * a duplicate SKU marks only the LATER row and names the row it collides
//     with. Flagging both leaves the seller with no way to tell which to change.
//   * bulk apply says how many rows it will change, and the previous matrix is
//     kept so Hoàn tác is one click rather than retyping.
//   * turning the matrix off asks which variant survives. Picking silently
//     would throw away a SKU somebody prints on shipping labels.
//
// Stock typed here is saved with the matrix and becomes a `correction` movement
// in the ledger. It is never a PATCH: the counter moves only through
// product_variant_adjust_stock, whatever the UI looks like.
// ============================================================================

import { memo, useCallback, useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react";
import { shopErrorMessage } from "@/lib/shop/errors";
import { vnd } from "@/lib/shop/productState";
import {
  VARIANT_LIMITS,
  applyBulk,
  combinationCount,
  comboLabel,
  hasRowErrors,
  optionKey,
  reconcileRows,
  removedRows,
  validateGroups,
  validateRows,
  type BulkField,
  type OptionGroup,
  type RowErrors,
  type VariantRow,
} from "@/lib/shop/variantMatrix";

export interface VariantEditorProps {
  disabled: boolean;
  /** Server truth, already sorted by position. */
  initialGroups: OptionGroup[];
  initialRows: VariantRow[];
  /** Server ids of the current rows, used when collapsing back to one variant. */
  onSave: (input: {
    groups: OptionGroup[];
    rows: VariantRow[];
    keepVariantId?: string | null;
  }) => Promise<unknown>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const emptyGroup = (): OptionGroup => ({ name: "", values: [] });

/** Values are typed as one comma-separated line — the fastest thing to enter on
 *  a phone — and echoed back as pills so the seller sees what was understood
 *  rather than trusting the separator. */
const parseValues = (text: string) =>
  text
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export default function VariantEditor({
  disabled,
  initialGroups,
  initialRows,
  onSave,
}: VariantEditorProps) {
  const [multi, setMulti] = useState(initialGroups.length > 0);
  const [groups, setGroups] = useState<OptionGroup[]>(initialGroups);
  const [rows, setRows] = useState<VariantRow[]>(initialRows);
  const [undoRows, setUndoRows] = useState<VariantRow[] | null>(null);
  const [pendingGroups, setPendingGroups] = useState<OptionGroup[] | null>(null);
  const [keepId, setKeepId] = useState<string | null>(initialRows[0]?.id ?? null);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const groupsError = useMemo(() => validateGroups(groups), [groups]);
  const rowErrors = useMemo(() => validateRows(rows), [rows]);
  const blocked = hasRowErrors(rowErrors) || !!groupsError;
  const combos = combinationCount(groups);

  /** Applying a group change is what rebuilds the matrix — and it keeps every
   *  row whose combination survived, with its id, price, stock and SKU. */
  const applyGroups = useCallback(
    (next: OptionGroup[]) => {
      setGroups(next);
      setPendingGroups(null);
      // Rebuild only from a structure that is actually valid. A group that is
      // named but has no values yet, or that holds a duplicate, is a state the
      // seller passes THROUGH on the way to a good one — not a decision. The
      // matrix is the only copy of its SKUs and stock counts, and rebuilding
      // on a half-typed group drops every row it cannot place, silently and
      // for good: correcting the typo afterwards brings the combinations back
      // empty, because the data they held is no longer in `current`.
      if (validateGroups(next)) return;
      setRows((current) =>
        // The price is seeded so a new size is a number to confirm rather than
        // retype. The stock is NOT: 3 pairs of 39 are not also 3 pairs of 41,
        // and this number is saved as a stock correction.
        reconcileRows(next, current, { priceVnd: current[0]?.priceVnd ?? "", stockOnHand: "" }),
      );
    },
    [],
  );

  const proposeGroups = (next: OptionGroup[]) => {
    // Only ask when something is actually about to be lost.
    const losing = validateGroups(next) ? [] : removedRows(next, rows);
    if (losing.length > 0) setPendingGroups(next);
    else applyGroups(next);
  };

  const setRow = useCallback((index: number, field: keyof VariantRow, value: string) => {
    setRows((current) => {
      const next = current.slice();
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setState("idle");
  }, []);

  const save = async () => {
    if (blocked) return;
    setState("saving");
    setError(null);
    try {
      await onSave({
        groups: multi ? groups : [],
        rows,
        keepVariantId: multi ? null : keepId,
      });
      setState("saved");
      setUndoRows(null);
    } catch (e) {
      setState("error");
      setError(shopErrorMessage(e));
    }
  };

  return (
    <section aria-labelledby="sec-variants">
      <h2 id="sec-variants" className="tl-shop-h2">
        Phiên bản, giá &amp; tồn kho
      </h2>

      <label className="tl-shop-check" style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={multi}
          disabled={disabled}
          onChange={(e) => {
            const on = e.target.checked;
            setMulti(on);
            setState("idle");
            if (on && groups.length === 0) {
              setGroups([emptyGroup()]);
            } else if (!on) {
              // Nothing is applied yet — the switch is saved, not autosaved —
              // so the seller can change their mind before anything happens.
              setRows((current) => reconcileRows([], current, current[0]));
            }
          }}
        />
        <span>Sản phẩm có nhiều phiên bản (màu, size…)</span>
      </label>

      {!multi && rows.length <= 1 && (
        <p className="tl-shop-hint" style={{ marginTop: -4 }}>
          Đang là sản phẩm đơn: một giá, một mức tồn kho.
        </p>
      )}

      {/* Turning the matrix off — the seller chooses what survives. */}
      {!multi && initialGroups.length > 0 && (
        <div className="tl-shop-notice tl-shop-notice--warn" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <div style={{ width: "100%" }}>
            <strong>Tắt nhiều phiên bản sẽ giữ lại đúng một phiên bản.</strong>
            <p style={{ margin: "6px 0 10px", lineHeight: 1.55 }}>
              {initialRows.length - 1} phiên bản còn lại sẽ ngừng bán — không bị xoá, mã hàng và
              lịch sử kho vẫn còn, bật lại được sau. Chọn phiên bản giữ lại:
            </p>
            <div className="tl-shop-field" style={{ marginBottom: 0 }}>
              <label className="tl-shop-label" htmlFor="keep-variant">
                Phiên bản giữ lại
              </label>
              <select
                id="keep-variant"
                className="tl-shop-select"
                value={keepId ?? ""}
                onChange={(e) => setKeepId(e.target.value || null)}
              >
                {initialRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {comboLabel(initialGroups, row.optionValues)} ·{" "}
                    {row.priceVnd ? vnd(Number(row.priceVnd)) : "chưa có giá"}
                    {row.sku ? ` · ${row.sku}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {multi && (
        <>
          <GroupEditor
            groups={groups}
            disabled={disabled}
            error={groupsError}
            combos={combos}
            onChange={proposeGroups}
          />

          {pendingGroups && (
            <DestructiveNotice
              losing={removedRows(pendingGroups, rows)}
              groups={groups}
              onConfirm={() => applyGroups(pendingGroups)}
              onCancel={() => setPendingGroups(null)}
            />
          )}

          {rows.length > 0 && !groupsError && (
            <BulkPanel
              count={rows.length}
              disabled={disabled}
              onApply={(field, value) => {
                setUndoRows(rows);
                const result = applyBulk(rows, field, value);
                setRows(result.rows);
                setState("idle");
                return result.changed;
              }}
              onUndo={undoRows ? () => { setRows(undoRows); setUndoRows(null); } : undefined}
            />
          )}
        </>
      )}

      <MatrixTable
        groups={multi ? groups : []}
        rows={rows}
        errors={rowErrors}
        disabled={disabled}
        onChange={setRow}
      />

      {!disabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--primary"
            disabled={state === "saving" || blocked}
            onClick={() => void save()}
          >
            {state === "saving" ? "Đang lưu…" : "Lưu bảng phiên bản"}
          </button>
          {state === "saved" && (
            <span className="tl-shop-pill tl-shop-pill--ok" role="status">
              <Check size={14} aria-hidden="true" /> Đã lưu
            </span>
          )}
          {blocked && (
            <span className="tl-shop-pill tl-shop-pill--warn" role="status">
              Còn ô chưa hợp lệ
            </span>
          )}
          {state === "error" && (
            <span className="tl-shop-pill tl-shop-pill--danger" role="status">
              Chưa lưu được
            </span>
          )}
        </div>
      )}

      {state === "error" && error && (
        <div className="tl-shop-notice tl-shop-notice--danger" role="alert" style={{ marginTop: 10 }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => void save()}>
            Thử lại
          </button>
        </div>
      )}

      <p className="tl-shop-hint">
        Sửa tồn kho ở đây được ghi vào sổ kho với lý do &ldquo;sửa lại cho đúng thực tế&rdquo;. Số
        này là <strong>hàng đang có</strong>; khi mở bán và có đơn, phần đã giữ cho đơn sẽ được
        tính riêng.
      </p>
    </section>
  );
}

// ─── Option groups ──────────────────────────────────────────────────────────

function GroupEditor({
  groups,
  disabled,
  error,
  combos,
  onChange,
}: {
  groups: OptionGroup[];
  disabled: boolean;
  error: ReturnType<typeof validateGroups>;
  combos: number;
  onChange: (next: OptionGroup[]) => void;
}) {
  const patch = (index: number, next: Partial<OptionGroup>) =>
    onChange(groups.map((g, i) => (i === index ? { ...g, ...next } : g)));

  // Wave 0: "Nhóm cần ít nhất một giá trị" flashed red WHILE the seller was
  // still typing the group name — the values field simply had not been
  // reached yet. Validity still blocks Save live; the MESSAGE waits until the
  // seller has actually left a field of that row.
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const touch = (i: number) => setTouched((prev) => new Set(prev).add(i));
  // Deleting group i shifts every later group down one index — the touched
  // set must shift with them, or the group that slides into slot i inherits a
  // blur it never had and shows its error mid-typing (Codex review).
  const removeGroup = (i: number) => {
    setTouched((prev) => {
      const next = new Set<number>();
      for (const t of prev) {
        if (t < i) next.add(t);
        else if (t > i) next.add(t - 1);
      }
      return next;
    });
    onChange(groups.filter((_, k) => k !== i));
  };
  const shownError = error && (error.index === -1 || touched.has(error.index)) ? error : null;

  return (
    <div style={{ marginBottom: 16 }}>
      {groups.map((group, i) => (
        <div key={i} className="tl-shop-card" style={{ marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div className="tl-shop-field" style={{ marginBottom: 0 }}>
              <label className="tl-shop-label" htmlFor={`grp-name-${i}`}>
                Tên nhóm {i + 1}
              </label>
              <input
                id={`grp-name-${i}`}
                className="tl-shop-input"
                maxLength={VARIANT_LIMITS.nameLength}
                placeholder="Màu sắc"
                disabled={disabled}
                value={group.name}
                aria-invalid={shownError?.index === i}
                onChange={(e) => patch(i, { name: e.target.value })}
                onBlur={() => touch(i)}
              />
            </div>
            <div className="tl-shop-field" style={{ marginBottom: 0 }}>
              <label className="tl-shop-label" htmlFor={`grp-vals-${i}`}>
                Giá trị, cách nhau bằng dấu phẩy
              </label>
              <input
                id={`grp-vals-${i}`}
                className="tl-shop-input"
                placeholder="Trắng, Đen"
                disabled={disabled}
                defaultValue={group.values.join(", ")}
                aria-invalid={shownError?.index === i}
                onBlur={(e) => { touch(i); patch(i, { values: parseValues(e.target.value) }); }}
              />
            </div>
          </div>

          {group.values.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {group.values.map((v) => (
                <span key={v} className="tl-shop-pill tl-shop-pill--muted">
                  {v}
                </span>
              ))}
            </div>
          )}

          {shownError?.index === i && (
            <p className="tl-shop-error" role="alert">
              {shownError.message}
            </p>
          )}

          {!disabled && groups.length > 1 && (
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--danger"
              style={{ marginTop: 10 }}
              onClick={() => removeGroup(i)}
            >
              <Trash2 size={14} aria-hidden="true" /> Xoá nhóm
            </button>
          )}
        </div>
      ))}

      {shownError && shownError.index === -1 && (
        <p className="tl-shop-error" role="alert">
          {shownError.message}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {!disabled && groups.length < VARIANT_LIMITS.groups && (
          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--sm"
            onClick={() => onChange([...groups, emptyGroup()])}
          >
            <Plus size={14} aria-hidden="true" /> Thêm nhóm
          </button>
        )}
        <span className="tl-shop-hint" style={{ marginTop: 0 }}>
          {combos > 0
            ? `${combos} phiên bản · tối đa ${VARIANT_LIMITS.combinations}`
            : `Tối đa ${VARIANT_LIMITS.groups} nhóm, ${VARIANT_LIMITS.combinations} phiên bản`}
        </span>
      </div>
    </div>
  );
}

function DestructiveNotice({
  losing,
  groups,
  onConfirm,
  onCancel,
}: {
  losing: VariantRow[];
  groups: OptionGroup[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <div style={{ width: "100%" }}>
        <strong>Thay đổi này bỏ {losing.length} phiên bản:</strong>
        <ul style={{ margin: "8px 0", paddingLeft: 18, lineHeight: 1.6 }}>
          {losing.slice(0, 8).map((row, i) => (
            <li key={i}>
              {comboLabel(groups, row.optionValues)}
              {row.sku ? ` · ${row.sku}` : ""}
              {row.stockOnHand ? ` · còn ${row.stockOnHand}` : ""}
            </li>
          ))}
          {losing.length > 8 && <li>…và {losing.length - 8} phiên bản nữa</li>}
        </ul>
        <p className="tl-shop-hint" style={{ marginTop: 0 }}>
          Chúng sẽ ngừng bán khi anh/chị lưu bảng — không bị xoá, bật lại được sau.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--danger" onClick={onConfirm}>
            Vẫn đổi
          </button>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={onCancel}>
            Giữ như cũ
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk ───────────────────────────────────────────────────────────────────

function BulkPanel({
  count,
  disabled,
  onApply,
  onUndo,
}: {
  count: number;
  disabled: boolean;
  onApply: (field: BulkField, value: string) => number;
  onUndo?: () => void;
}) {
  const [field, setField] = useState<BulkField>("priceVnd");
  const [value, setValue] = useState("");
  const [changed, setChanged] = useState<number | null>(null);

  if (disabled) return null;

  return (
    <div className="tl-shop-card" style={{ marginBottom: 14 }}>
      <p style={{ fontWeight: 600, marginBottom: 10 }}>
        Đặt {field === "priceVnd" ? "giá" : "tồn kho"} cho {count} phiên bản cùng lúc
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="tl-shop-field" style={{ marginBottom: 0, flex: "1 1 150px" }}>
          <label className="tl-shop-label" htmlFor="bulk-field">
            Đổi ô nào
          </label>
          <select
            id="bulk-field"
            className="tl-shop-select"
            value={field}
            onChange={(e) => {
              setField(e.target.value as BulkField);
              setChanged(null);
            }}
          >
            <option value="priceVnd">Giá</option>
            <option value="stockOnHand">Tồn kho</option>
          </select>
        </div>
        <div className="tl-shop-field" style={{ marginBottom: 0, flex: "1 1 150px" }}>
          <label className="tl-shop-label" htmlFor="bulk-value">
            Giá trị mới
          </label>
          <input
            id="bulk-value"
            className="tl-shop-input"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setChanged(null);
            }}
          />
        </div>
        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--primary"
          disabled={!value.trim()}
          onClick={() => setChanged(onApply(field, value.trim()))}
        >
          Áp cho tất cả
        </button>
        {onUndo && (
          <button type="button" className="tl-shop-btn" onClick={onUndo}>
            Hoàn tác
          </button>
        )}
      </div>
      {changed !== null && (
        <p className="tl-shop-hint" role="status">
          {changed === 0
            ? "Không phiên bản nào đổi — tất cả đã bằng giá trị đó."
            : `Đã đổi ${changed} phiên bản. Chưa lưu — bấm "Lưu bảng phiên bản" để ghi lại.`}
        </p>
      )}
    </div>
  );
}

// ─── Matrix ─────────────────────────────────────────────────────────────────

interface CellsProps {
  index: number;
  row: VariantRow;
  errors: RowErrors;
  disabled: boolean;
  label: string;
  onChange: (index: number, field: keyof VariantRow, value: string) => void;
}

/**
 * One row, memoised.
 *
 * With 100 combinations, re-rendering the whole table on every keystroke is
 * ~300 controlled inputs per character. `onChange` is stable (useCallback with
 * no deps) and `row`/`errors` change identity only for the row that actually
 * changed, so typing re-renders one row.
 */
const RowCells = memo(function RowCells({ index, row, errors, disabled, label, onChange }: CellsProps) {
  return (
    <>
      <input
        className="tl-shop-input"
        aria-label={`Mã hàng ${label}`}
        aria-invalid={!!errors.sku}
        disabled={disabled}
        value={row.sku}
        onChange={(e) => onChange(index, "sku", e.target.value)}
      />
      <input
        className="tl-shop-input"
        inputMode="numeric"
        aria-label={`Giá ${label}`}
        aria-invalid={!!errors.priceVnd}
        disabled={disabled}
        value={row.priceVnd}
        onChange={(e) => onChange(index, "priceVnd", e.target.value)}
      />
      <input
        className="tl-shop-input"
        inputMode="numeric"
        placeholder="không đếm"
        aria-label={`Tồn kho ${label}`}
        aria-invalid={!!errors.stockOnHand}
        disabled={disabled}
        value={row.stockOnHand}
        onChange={(e) => onChange(index, "stockOnHand", e.target.value)}
      />
    </>
  );
});

const RowMessages = ({ errors }: { errors: RowErrors }) =>
  errors.sku || errors.priceVnd || errors.stockOnHand ? (
    <p className="tl-shop-error" role="alert">
      {[errors.sku, errors.priceVnd, errors.stockOnHand].filter(Boolean).join(" · ")}
    </p>
  ) : null;

function MatrixTable({
  groups,
  rows,
  errors,
  disabled,
  onChange,
}: {
  groups: OptionGroup[];
  rows: VariantRow[];
  errors: RowErrors[];
  disabled: boolean;
  onChange: (index: number, field: keyof VariantRow, value: string) => void;
}) {
  const names = groups.map((g) => g.name.trim()).filter(Boolean);

  return (
    <>
      {/* Desktop table */}
      <div className="tl-shop-tablewrap" tabIndex={0} data-desktop-only>
        <table className="tl-shop-table">
          <caption className="tl-shop-sr">Bảng phiên bản: mã hàng, giá và tồn kho</caption>
          <thead>
            <tr>
              {names.map((n) => (
                <th key={n} scope="col">
                  {n}
                </th>
              ))}
              <th scope="col">Mã hàng (SKU)</th>
              <th scope="col">Giá (₫)</th>
              <th scope="col">Hàng đang có</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const label = comboLabel(groups, row.optionValues) || "sản phẩm";
              return (
                <tr key={optionKey(row.optionValues) ?? row.id ?? "default"}>
                  {names.map((n) => (
                    <td key={n}>{row.optionValues[n] ?? "—"}</td>
                  ))}
                  <td colSpan={3} style={{ padding: 0 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: "6px 10px" }}>
                      <RowCells
                        index={i}
                        row={row}
                        errors={errors[i] ?? {}}
                        disabled={disabled}
                        label={label}
                        onChange={onChange}
                      />
                    </div>
                    <div style={{ padding: "0 10px 6px" }}>
                      <RowMessages errors={errors[i] ?? {}} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile — a table this wide is unusable at 375px, so each variant is a
          card with its own labelled fields rather than a shrunken grid. */}
      <div className="tl-shop-varcards" data-mobile-only>
        {rows.map((row, i) => {
          const label = comboLabel(groups, row.optionValues) || "Sản phẩm";
          return (
            <div key={optionKey(row.optionValues) ?? row.id ?? "default"} className="tl-shop-varcard">
              <p style={{ fontWeight: 600, marginBottom: 8 }}>{label}</p>
              <div style={{ display: "grid", gap: 8 }}>
                <RowCells
                  index={i}
                  row={row}
                  errors={errors[i] ?? {}}
                  disabled={disabled}
                  label={label}
                  onChange={onChange}
                />
              </div>
              <RowMessages errors={errors[i] ?? {}} />
            </div>
          );
        })}
      </div>
    </>
  );
}
