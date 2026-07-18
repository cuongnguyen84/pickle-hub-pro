import XCTest
import SwiftUI
@testable import ThePickleHub

/// DS-03 — render-smoke for the design-system components at the LARGEST
/// accessibility type size. Not a pixel snapshot: it proves each component
/// (a) builds a real view hierarchy at AX3 without crashing and (b) lays
/// out to a non-zero, finite size. The silent-clip class of bugs (sheet
/// cutting off its confirm button at big type) is prevented structurally —
/// TLSheet always wraps content in a ScrollView — and these tests pin that
/// the wrapped hierarchy keeps rendering at AX3.
final class TLComponentsRenderTests: XCTestCase {

    private func assertRenders<V: View>(_ view: V, _ name: String) {
        let host = UIHostingController(
            rootView: view.dynamicTypeSize(.accessibility3)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 320, height: 800)
        host.view.layoutIfNeeded()
        let size = host.sizeThatFits(in: CGSize(width: 320, height: CGFloat.greatestFiniteMagnitude))
        XCTAssertGreaterThan(size.height, 0, "\(name) collapsed to zero height at AX3")
        XCTAssertTrue(size.height.isFinite, "\(name) has unbounded height at AX3")
    }

    func testTLButtonKindsRenderAtAX3() {
        assertRenders(TLButton(title: "Xác nhận đăng ký", kind: .green) {}, "TLButton.green")
        assertRenders(TLButton(title: "Xác nhận đăng ký", kind: .cream) {}, "TLButton.cream")
        assertRenders(TLButton(title: "Huỷ", kind: .outline, isLoading: true) {}, "TLButton.outline+loading")
    }

    func testTLPrimaryButtonStillDelegates() {
        assertRenders(TLPrimaryButton(title: "Đăng ký ngay") {}, "TLPrimaryButton")
    }

    func testTLIconButtonRendersWithRequiredLabel() {
        assertRenders(TLIconButton(systemName: "xmark", label: "Đóng") {}, "TLIconButton")
    }

    func testTLBadgeRendersAtAX3() {
        assertRenders(TLBadge(text: "Chưa thanh toán"), "TLBadge")
    }

    func testTLSelectRendersAtAX3() {
        assertRenders(
            TLSelect(
                label: "Trình độ",
                options: [(value: 1, label: "2.5 — 3.0"), (value: 2, label: "3.5 — 4.0")],
                selection: .constant(1)
            ),
            "TLSelect"
        )
    }

    func testTLSheetScrollsTallContentAtAX3() {
        // 30 rows at AX3 far exceeds any detent — the ScrollView wrapper is
        // what keeps the confirm button reachable instead of clipped.
        assertRenders(
            TLSheet(title: "Đăng ký sự kiện") {
                ForEach(0..<30, id: \.self) { i in
                    Text("Dòng nội dung số \(i) — cỡ chữ trợ năng")
                }
                TLButton(title: "Xác nhận đăng ký", kind: .green) {}
            },
            "TLSheet"
        )
    }

    func testTLDialogRendersAtAX3() {
        assertRenders(
            TLDialog(title: "Xoá đăng ký?") {
                Text("Hành động này không hoàn tác được.")
                TLButton(title: "Xoá", kind: .cream) {}
            },
            "TLDialog"
        )
    }
}
