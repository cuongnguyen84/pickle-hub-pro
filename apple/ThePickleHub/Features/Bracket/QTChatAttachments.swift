import Foundation
import UIKit

// ============================================================================
// Đính kèm cho chat AI tạo giải — khớp ĐÚNG hợp đồng của edge function
// `quick-table-chat` dùng chung với web:
//   attachment?:  { mime_type, data(base64) }   — 1 file
//   attachments?: cùng kiểu                       — 2..4 file
// MIME được nhận: image/jpeg, image/png, image/webp, application/pdf.
// Giới hạn (server trả 400 nếu vượt): tối đa 4 file, mỗi file base64
// ≤ 6.000.000 ký tự, tổng ≤ 8.000.000 ký tự.
// Như web: MỌI ảnh đều chuyển JPEG, cạnh dài nhất ≤ 1600px, quality 0.85
// (HEIC/PNG từ máy ảnh thành JPEG như web). PDF giữ nguyên dữ liệu gốc.
// File văn bản/bảng tính dạng chữ (txt/csv/tsv) KHÔNG đi qua attachment —
// web đọc tại chỗ thành chữ; bản native cũng vậy: nội dung chữ được ghép
// vào tin nhắn như khi người dùng dán. (xlsx/xls nhị phân: web có engine
// riêng, native chưa hỗ trợ — người dùng xuất CSV hoặc dán chữ.)
// ============================================================================

struct QTChatAttachment: Encodable, Equatable, Sendable {
    let mime_type: String
    let data: String
}

/// Một file đang chờ gửi trong ô soạn: hoặc payload attachment (ảnh/PDF),
/// hoặc nội dung chữ (file văn bản) sẽ ghép vào tin nhắn.
struct QTStagedAttachment: Identifiable, Equatable, Sendable {
    let id = UUID()
    let name: String
    let attachment: QTChatAttachment?
    let textContent: String?
    /// Dữ liệu ảnh gốc (đã nén JPEG) để vẽ thumbnail trong chip chờ gửi.
    let thumbnailData: Data?

    var isTextFile: Bool { textContent != nil }
}

enum QTChatAttachments {
    static let maxCount = 4
    static let maxPerFileB64 = 6_000_000
    static let maxTotalB64 = 8_000_000
    static let maxImageSide = 1600
    static let maxTextChars = 4000

    /// Đúng luật server: số lượng + trần từng file + trần tổng.
    static func isValid(_ attachments: [QTChatAttachment]) -> Bool {
        guard attachments.count <= maxCount else { return false }
        var total = 0
        for a in attachments {
            guard !a.data.isEmpty, a.data.count <= maxPerFileB64 else { return false }
            total += a.data.count
            guard total <= maxTotalB64 else { return false }
        }
        return true
    }

    /// Ảnh bất kỳ (HEIC/PNG/JPEG…) → JPEG cạnh dài ≤ 1600px, quality 0.85.
    static func jpegAttachment(fromImageData data: Data) -> QTChatAttachment? {
        guard let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        var target = image
        if longest > CGFloat(maxImageSide) {
            let scale = CGFloat(maxImageSide) / longest
            let size = CGSize(width: (image.size.width * scale).rounded(),
                              height: (image.size.height * scale).rounded())
            let renderer = UIGraphicsImageRenderer(size: size)
            target = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        }
        guard let jpeg = target.jpegData(compressionQuality: 0.85) else { return nil }
        return QTChatAttachment(mime_type: "image/jpeg", data: jpeg.base64EncodedString())
    }

    /// PDF giữ nguyên; quá trần base64 của server thì từ chối ngay tại máy.
    static func pdfAttachment(from data: Data) -> QTChatAttachment? {
        let b64 = data.base64EncodedString()
        guard b64.count <= maxPerFileB64 else { return nil }
        return QTChatAttachment(mime_type: "application/pdf", data: b64)
    }

    /// File chữ → nội dung đã cắt gọn như web (trim, tối đa 4000 ký tự).
    static func textContent(from data: Data) -> String? {
        guard let raw = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .utf16) else { return nil }
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        return String(text.prefix(maxTextChars))
    }

    struct Outgoing: Equatable {
        /// Chữ hiển thị trong bong bóng + gửi kèm (gồm nội dung file chữ).
        let text: String
        /// Đúng 1 file → `attachment`; 2–4 file → `attachments` (như web).
        let attachment: QTChatAttachment?
        let attachments: [QTChatAttachment]?
    }

    /// Ghép tin gửi đi từ chữ người dùng gõ + các file đang chờ.
    /// Chỉ có file ảnh/PDF mà không có chữ: bong bóng hiện nhãn kiểu web
    /// ("🖼️ tên ảnh" / "📎 tên.pdf") và nhãn đó cũng là text gửi đi.
    static func assemble(typedText: String, staged: [QTStagedAttachment]) -> Outgoing {
        let files = staged.compactMap(\.attachment)
        let texts = staged.compactMap(\.textContent)
        var parts: [String] = []
        let typed = typedText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !typed.isEmpty { parts.append(typed) }
        parts.append(contentsOf: texts)
        if parts.isEmpty {
            parts = staged.compactMap { item in
                guard item.attachment != nil else { return nil }
                return item.attachment?.mime_type == "application/pdf" ? "📎 \(item.name)" : "🖼️ \(item.name)"
            }
        }
        return Outgoing(
            text: parts.joined(separator: "\n"),
            attachment: files.count == 1 ? files[0] : nil,
            attachments: files.count > 1 ? files : nil)
    }
}
