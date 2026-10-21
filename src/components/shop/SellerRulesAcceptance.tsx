// ============================================================================
// Seller rules — the last step of the application, and the only one that
// records a legal fact.
// ----------------------------------------------------------------------------
// This component does not authorize anything. shop_application_submit() checks
// acceptance in Postgres, so a seller who never renders this screen is refused
// all the same. What it owes the person in front of it is different and just as
// load-bearing:
//
//   · show the document — the actual text, not a link to a promise of one;
//   · never enable the checkbox before the text has loaded, because a tick over
//     an empty box is consent to nothing;
//   · say which of four states it is in, in words, and never claim "signed"
//     when the write failed;
//   · survive a refresh by reading the receipt back from the server rather than
//     from a local flag.
//
// The version race is the case worth reading twice. A form can sit open across
// a version change; the checkbox would still be ticked and the local state
// would still say "accepted". So the version in hand is compared with the
// version in force on every render, and a mismatch takes the acceptance away
// and asks the person to read the new text — the same answer the server would
// give, arrived at before they press a button rather than after.
// ============================================================================

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, RotateCcw } from "lucide-react";
import { renderRulesMarkdown } from "@/lib/shop/rulesMarkdown";
import {
  useAcceptSellerRules,
  useSellerRulesDocument,
  useSellerRulesReceipt,
  sellerRulesErrorMessage,
} from "@/hooks/shop/useSellerRules";

export interface SellerRulesState {
  /** True only when the SERVER says this applicant accepted the version in
   *  force. The submit button is disabled otherwise — not as a security
   *  control, but so nobody is invited to press a button that will refuse. */
  ready: boolean;
  /** Echoed to shop_application_submit so a stale form is refused. */
  version: string | null;
}

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN");
};

export function SellerRulesAcceptance({
  applicationId,
  onChange,
}: {
  applicationId: string | null;
  onChange: (state: SellerRulesState) => void;
}) {
  const doc = useSellerRulesDocument();
  const receipt = useSellerRulesReceipt(applicationId);
  const accept = useAcceptSellerRules();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const document = doc.data ?? null;
  const view = receipt.data;
  // Accepted means: the server has a signature for the version in force. Not
  // "the box is ticked", and not "the mutation returned once this session".
  const accepted = view?.accepted === true && view.version === document?.version;
  // They signed something, just not this. Worth its own sentence — telling them
  // "you have not accepted the rules" when they remember doing so reads as a
  // bug and costs a support message.
  const staleSignature =
    view?.accepted === false && view.reason === "stale_version" && !!document;

  useEffect(() => {
    onChange({ ready: accepted, version: document?.version ?? null });
  }, [accepted, document?.version, onChange]);

  // A version change invalidates a tick made against the old text.
  useEffect(() => {
    if (staleSignature) setChecked(false);
  }, [staleSignature]);

  const onTick = async (next: boolean) => {
    setChecked(next);
    setError(null);
    if (!next || !document || accepted) return;
    try {
      await accept.mutateAsync(document);
      await receipt.refetch();
    } catch (err) {
      setChecked(false);
      setError(sellerRulesErrorMessage(err));
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (doc.isLoading) {
    return (
      <div className="tl-shop-notice tl-shop-notice--info" aria-live="polite">
        <div>
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Đang tải quy chế người bán…
        </div>
      </div>
    );
  }

  // ── The document could not be read ────────────────────────────────────────
  // Not the same as "there is no document", and the difference matters: one is
  // a network problem the seller can retry, the other is a thing nobody has
  // written yet. Both block the submit; only one is worth retrying.
  if (doc.isError) {
    return (
      <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
        <div>
          <strong>Không tải được quy chế người bán.</strong> Chưa gửi hồ sơ được cho tới khi
          đọc được văn bản — bản nháp của anh/chị vẫn còn nguyên.
          <div style={{ marginTop: 10 }}>
            <button type="button" className="tl-shop-btn" onClick={() => void doc.refetch()}>
              <RotateCcw size={14} aria-hidden="true" /> Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Nothing published ─────────────────────────────────────────────────────
  if (!document) {
    return (
      <div className="tl-shop-notice tl-shop-notice--warn">
        <div>
          <strong>Quy chế người bán chưa được ban hành.</strong> Ô đồng ý còn khoá, và máy chủ
          cũng từ chối gửi hồ sơ — ghi nhận việc đồng ý một văn bản không tồn tại thì chữ ký đó
          vô nghĩa. ThePickleHub sẽ báo khi có bản chính thức.
        </div>
      </div>
    );
  }

  const busy = accept.isPending || receipt.isFetching;

  return (
    <>
      <div className="tl-shop-card" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 650 }}>{document.title}</h2>
        <p className="tl-shop-hint" style={{ margin: "0 0 10px" }}>
          Bản {document.version} · hiệu lực từ {fmtDate(document.effective_at)}
        </p>
        {/* The text itself, scrollable in place. A link to a document somebody
            has to go and find is how "I read it" becomes untrue. */}
        <div
          className="tl-shop-doc"
          tabIndex={0}
          aria-label="Nội dung quy chế người bán"
          style={{
            maxHeight: 260,
            overflowY: "auto",
            fontSize: 13,
            lineHeight: 1.6,
            padding: "10px 12px",
            border: "1px solid var(--tl-border, rgba(0,0,0,.12))",
            borderRadius: 8,
          }}
        >
          {/* Rendered for reading; what the acceptance SIGNS is still the
              stored body, hash and all. */}
          {renderRulesMarkdown(document.body)}
        </div>
      </div>

      {staleSignature && (
        <div className="tl-shop-notice tl-shop-notice--warn" role="status">
          <div>
            <strong>Quy chế đã có bản mới.</strong> Anh/chị đã đồng ý bản{" "}
            {view?.accepted === false ? view.accepted_version : null} trước đây; bản đang áp dụng
            là {document.version}. Đọc lại và tích ô đồng ý bên dưới giúp em.
          </div>
        </div>
      )}

      <label
        className="tl-shop-check"
        style={{ alignItems: "flex-start", opacity: busy ? 0.6 : 1 }}
      >
        <input
          type="checkbox"
          style={{ marginTop: 3 }}
          // Never defaulted to ticked, and never re-ticked from local state:
          // `accepted` comes from the server, so a refresh shows the truth.
          checked={accepted || checked}
          disabled={busy || accepted}
          onChange={(e) => void onTick(e.target.checked)}
        />
        <span>
          Tôi đã đọc và đồng ý {document.title} (bản {document.version}).
        </span>
      </label>

      <div aria-live="polite" style={{ marginTop: 10 }}>
        {accept.isPending && (
          <p className="tl-shop-hint">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Đang ghi nhận…
          </p>
        )}
        {accepted && !accept.isPending && (
          <p className="tl-shop-hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={14} aria-hidden="true" />
            Đã ghi nhận lúc {fmtDate(view?.accepted === true ? view.accepted_at : null)} · bản{" "}
            {document.version}
          </p>
        )}
        {error && (
          <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
            <div>
              <AlertTriangle size={14} aria-hidden="true" /> <strong>Chưa ghi nhận được.</strong>{" "}
              {error}
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="tl-shop-btn"
                  disabled={busy}
                  onClick={() => void onTick(true)}
                >
                  <RotateCcw size={14} aria-hidden="true" /> Thử lại
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
