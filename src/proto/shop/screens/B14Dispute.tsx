// ============================================================================
// B14 — Dispute detail
// ----------------------------------------------------------------------------
// A dispute is a sequence of claims with deadlines. The screen is therefore a
// timeline where every entry is attributed and every open stage names who owes
// the next move and when the clock runs out — including what happens if nobody
// moves, which is the part users actually worry about.
// ============================================================================

import { Link, useLocation, useParams } from "react-router-dom";
import { Clock, Scale, Paperclip } from "lucide-react";
import { readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { EvidenceViewer } from "../components/Forms";
import { DISPUTES, disputeById, orderByCode, shopById, untilDeadline, dmyhm, type ProtoDispute } from "../fixtures";

const STAGE: Record<
  ProtoDispute["stage"],
  { title: string; who: string; tone: "" | "--warn" | "--danger" | "--info"; ifNobody: string }
> = {
  "cho-nguoi-ban": {
    title: "Chờ người bán trả lời",
    who: "Người bán",
    tone: "--warn",
    ifNobody: "Người bán không trả lời đúng hạn thì quản trị viên xử lý dựa trên bằng chứng hiện có.",
  },
  "cho-nguoi-mua": {
    title: "Chờ anh/chị trả lời",
    who: "Anh/chị",
    tone: "--warn",
    ifNobody: "Anh/chị không trả lời đúng hạn thì khiếu nại đóng lại và giữ nguyên đơn hàng.",
  },
  "admin-xem-xet": {
    title: "Quản trị viên đang xem xét",
    who: "Quản trị viên",
    tone: "--info",
    ifNobody: "Không có hạn cho bước này. Anh/chị sẽ nhận thông báo khi có quyết định.",
  },
  "xong-nguoi-mua": {
    title: "Đã xử lý — nghiêng về người mua",
    who: "Không ai",
    tone: "--info",
    ifNobody: "",
  },
  "xong-nguoi-ban": {
    title: "Đã xử lý — giữ nguyên đơn hàng",
    who: "Không ai",
    tone: "",
    ifNobody: "",
  },
};

const WHO_LABEL = { buyer: "Anh/chị", seller: "Người bán", admin: "Quản trị viên" } as const;

export default function B14Dispute() {
  const { id } = useParams();
  const location = useLocation();
  const dispute = disputeById(readVariant(location.search) || id || "dis-1");
  const order = orderByCode(dispute.orderCode);
  const shop = shopById(order.shopId);
  const stage = STAGE[dispute.stage];
  const deadline = dispute.deadline ? untilDeadline(dispute.deadline) : null;
  const open = !dispute.outcome;

  return (
    <BuyerShell title="Khiếu nại" backTo={`/proto/shop/order/${order.code}`} cartCount={null}>
      <main className="tl-shop-page tl-shop-page--narrow">
        <p className="tl-shop-eyebrow">
          Khiếu nại · đơn {order.code} · {shop.name}
        </p>
        <h1 className="tl-shop-h1" style={{ fontSize: "clamp(18px, 4.5vw, 22px)" }}>
          {dispute.reason}
        </h1>

        <div className={`tl-shop-notice tl-shop-notice${stage.tone}`}>
          <Clock size={16} aria-hidden="true" />
          <div>
            <strong>{stage.title}.</strong>{" "}
            {deadline && (
              <>
                Hạn: <strong>{deadline.text}</strong>.{" "}
              </>
            )}
            {stage.ifNobody}
          </div>
        </div>

        {dispute.outcome && (
          <div className="tl-shop-notice tl-shop-notice--info">
            <Scale size={16} aria-hidden="true" />
            <div>
              <strong>Kết quả:</strong> {dispute.outcome}
            </div>
          </div>
        )}

        <section aria-labelledby="b14-timeline">
          <h2 className="tl-shop-h2" id="b14-timeline">
            Diễn biến
          </h2>
          <ol className="tl-shop-timeline">
            {dispute.entries.map((e, i) => (
              <li key={`${e.at}-${i}`} className={i === dispute.entries.length - 1 ? "is-current" : "is-done"}>
                <div className="tl-shop-timeline-when">{dmyhm(e.at)}</div>
                <div className="tl-shop-timeline-who" style={{ fontWeight: 650, color: "var(--tl-fg-2)" }}>
                  {WHO_LABEL[e.by]}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--tl-fg)" }}>{e.text}</p>
                {e.evidence && e.evidence.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <p className="tl-shop-hint" style={{ marginTop: 0, marginBottom: 6 }}>
                      <Paperclip size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> {e.evidence.length} bằng chứng
                    </p>
                    <EvidenceViewer items={e.evidence.map((label) => ({ label }))} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>

        {open && dispute.stage === "cho-nguoi-mua" && (
          <section aria-labelledby="b14-reply">
            <h2 className="tl-shop-h2" id="b14-reply">
              Trả lời
            </h2>
            <label className="tl-shop-field">
              <span className="tl-shop-label">Phản hồi của anh/chị</span>
              <textarea className="tl-shop-textarea" placeholder="Người bán và quản trị viên sẽ đọc." />
              <span className="tl-shop-hint">
                Người bán đọc được đoạn này. Khiếu nại không phải nơi trao đổi riêng tư.
              </span>
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="tl-shop-btn tl-shop-btn--primary">
                Gửi phản hồi
              </button>
              <button type="button" className="tl-shop-btn">
                Chấp nhận đề nghị của người bán
              </button>
            </div>
          </section>
        )}

        {open && dispute.stage !== "cho-nguoi-mua" && (
          <div className="tl-shop-notice">
            <div>
              Hiện chưa cần anh/chị làm gì. Khi tới lượt, anh/chị sẽ nhận thông báo và ô trả lời
              sẽ hiện ở đây.
            </div>
          </div>
        )}

        <nav aria-label="Bản mẫu · trạng thái khiếu nại" style={{ marginTop: 28 }}>
          <div className="tl-shop-cats">
            {DISPUTES.map((d) => (
              <Link
                key={d.id}
                to={`?variant=${d.id}`}
                className="tl-shop-cat"
                aria-current={d.id === dispute.id ? "page" : undefined}
              >
                {d.stage}
              </Link>
            ))}
          </div>
        </nav>
      </main>
    </BuyerShell>
  );
}
