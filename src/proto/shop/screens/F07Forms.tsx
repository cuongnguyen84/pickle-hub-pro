// ============================================================================
// F07 — Seller / admin form primitives, state matrix
// ============================================================================

import { useState } from "react";
import {
  SellerApplicationStepper,
  AutosaveIndicator,
  DocumentUploader,
  ListingStatusBadge,
  VariantMatrix,
  ModerationDecisionForm,
  EvidenceViewer,
  type AutosaveState,
} from "../components/Forms";
import { MatrixSection, Cell, Cells } from "../components/Matrix";
import { productById } from "../fixtures";

export const APPLICATION_STEPS = [
  { key: "loai", label: "Loại người bán" },
  { key: "danh-tinh", label: "Danh tính" },
  { key: "shop", label: "Thông tin shop" },
  { key: "dia-chi", label: "Địa chỉ" },
  { key: "giay-to", label: "Giấy tờ" },
  { key: "gui", label: "Xem lại & gửi" },
];

export default function F07Forms() {
  const [step, setStep] = useState(2);
  const [autosave, setAutosave] = useState<AutosaveState>("saved");

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">F07</p>
      <h1 className="tl-shop-h1">Thành phần biểu mẫu người bán &amp; quản trị</h1>
      <p className="tl-shop-sub">
        Hai quy tắc chạy xuyên suốt: không bao giờ nói &ldquo;đã lưu&rdquo; mà không nói lưu
        lúc nào; và mọi ô chữ quản trị viên gõ đều dán nhãn rõ là nội bộ hay người nộp đọc
        được.
      </p>

      <div className="tl-shop-notice tl-shop-notice--warn">
        <div>
          <strong>Ghi chú thiết kế — không phải nội dung sản phẩm.</strong> Ô tải giấy tờ bên
          dưới được dựng vì bảng công việc yêu cầu. Bản đề xuất đã duyệt
          (<code>docs/proposals/shop-marketplace/proposal.md</code>) kết luận{" "}
          <strong>không thu CCCD / tài khoản ngân hàng ở giai đoạn thử nghiệm</strong>. Nếu
          giữ ô này, phải có kho riêng (private bucket) và cơ chế phát hiện rò rỉ — hiện chưa
          có cái nào.
        </div>
      </div>

      <MatrixSection
        id="f07-stepper"
        title="SellerApplicationStepper"
        note="Bước có lỗi hiện dấu chấm than và viền đỏ chứ không chỉ đổi màu — người mù màu vẫn thấy."
      >
        <Cells min={300}>
          <Cell label="Đang ở bước 3, xong 2 bước">
            <SellerApplicationStepper steps={APPLICATION_STEPS} current={step} completed={2} onJump={setStep} />
          </Cell>
          <Cell label="Bước 2 có lỗi">
            <SellerApplicationStepper steps={APPLICATION_STEPS} current={1} completed={4} errored={[1]} />
          </Cell>
        </Cells>
      </MatrixSection>

      <MatrixSection
        id="f07-autosave"
        title="AutosaveIndicator"
        note="Lỗi lưu không nói suông “có lỗi”, mà nói bản nháp vẫn còn trên máy — đó là điều người bán thật sự cần biết."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <AutosaveIndicator state="idle" />
          <AutosaveIndicator state="saving" />
          <AutosaveIndicator state="saved" savedAt="09:41" />
          <AutosaveIndicator state="error" onRetry={() => setAutosave("saving")} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["idle", "saving", "saved", "error"] as AutosaveState[]).map((s) => (
              <button key={s} type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => setAutosave(s)}>
                {s}
              </button>
            ))}
            <span className="tl-shop-hint" style={{ marginTop: 0, alignSelf: "center" }}>
              đang chọn: <AutosaveIndicator state={autosave} savedAt="09:41" />
            </span>
          </div>
        </div>
      </MatrixSection>

      <MatrixSection
        id="f07-upload"
        title="DocumentUploader"
        note="Mỗi ô bắt buộc phải nói LÝ DO xin ảnh đó. Yêu cầu ảnh CCCD mà không giải thích là lý do bỏ dở form phổ biến nhất."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 620 }}>
          <DocumentUploader
            label="Giấy phép hộ kinh doanh"
            purpose="Dùng để đối chiếu tên shop với tên đăng ký. Chỉ quản trị viên xem được."
            state="missing"
          />
          <DocumentUploader
            label="Giấy phép hộ kinh doanh"
            purpose="Đang tải lên, anh/chị đừng đóng trang."
            state="uploading"
            progress={62}
          />
          <DocumentUploader
            label="Giấy phép hộ kinh doanh"
            purpose="Đã nhận. Ảnh được lưu riêng, không hiển thị công khai."
            state="uploaded"
          />
          <DocumentUploader
            label="Giấy phép hộ kinh doanh"
            purpose="Chỉ quản trị viên xem được."
            state="rejected"
            rejectReason="Ảnh thiếu góc dưới nên không đọc được số đăng ký. Chụp lại đủ 4 góc giúp mình."
          />
        </div>
      </MatrixSection>

      <MatrixSection id="f07-status" title="ListingStatusBadge — 6 trạng thái">
        <Cells min={210}>
          {(["draft", "pending_review", "active", "needs_changes", "restricted", "archived"] as const).map((s) => (
            <Cell key={s} label={s}>
              <ListingStatusBadge status={s} withHint />
            </Cell>
          ))}
        </Cells>
      </MatrixSection>

      <MatrixSection
        id="f07-variants"
        title="VariantMatrix"
        note="Trên máy tính là bảng. Trên điện thoại chuyển thành thẻ — bảng 5 cột ở 375px không dùng được, cuộn ngang trong form là cách chắc chắn mất dữ liệu."
      >
        <VariantMatrix product={productById("p-2")} onBulk={() => {}} />
      </MatrixSection>

      <MatrixSection
        id="f07-evidence"
        title="EvidenceViewer"
        note="Bằng chứng thường (ảnh khiếu nại) hiện luôn. Giấy tờ tuỳ thân bị làm mờ tới khi bấm hiện, và việc mở được ghi nhật ký."
      >
        <Cells min={280}>
          <Cell label="Bằng chứng khiếu nại">
            <EvidenceViewer items={[{ label: "Ảnh mặt vợt khi nhận" }, { label: "Ảnh cận bề mặt", tone: "c" }]} />
          </Cell>
          <Cell label="Giấy tờ tuỳ thân (mờ mặc định)">
            <EvidenceViewer sensitive items={[{ label: "CCCD mặt trước" }, { label: "CCCD mặt sau", tone: "c" }]} />
          </Cell>
        </Cells>
      </MatrixSection>

      <MatrixSection
        id="f07-decision"
        title="ModerationDecisionForm"
        note="Ô người nộp đọc được và ô nội bộ có màu, viền và biểu tượng khác nhau, không chỉ khác nhãn — nhầm hai ô này là làm lộ ghi chú nội bộ ra ngoài."
      >
        <div style={{ maxWidth: 560 }}>
          <ModerationDecisionForm />
        </div>
      </MatrixSection>
    </main>
  );
}
