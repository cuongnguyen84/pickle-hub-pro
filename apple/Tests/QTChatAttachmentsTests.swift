import Foundation
import Testing
import UIKit
@testable import ThePickleHub

@Suite("QT chat attachments — edge contract (web parity)")
struct QTChatAttachmentsTests {

    private func att(_ chars: Int, mime: String = "image/jpeg") -> QTChatAttachment {
        QTChatAttachment(mime_type: mime, data: String(repeating: "A", count: chars))
    }

    @Test("Server limits: count, per-file and total base64 caps")
    func validationLimits() {
        #expect(QTChatAttachments.isValid([]))
        #expect(QTChatAttachments.isValid([att(6_000_000)]))
        #expect(QTChatAttachments.isValid([att(100), att(100), att(100), att(100)]))
        #expect(!QTChatAttachments.isValid([att(100), att(100), att(100), att(100), att(100)]))
        #expect(!QTChatAttachments.isValid([att(6_000_001)]))
        #expect(!QTChatAttachments.isValid([att(4_500_000), att(4_500_000)])) // tổng 9M > 8M
        #expect(!QTChatAttachments.isValid([att(0)]))
    }

    /// Cạnh dài nhất tính bằng PIXEL (cgImage) — UIImage.size là điểm
    /// logic, phụ thuộc scale của máy chạy test.
    private func pixelLongest(_ image: UIImage) -> Int {
        max(image.cgImage?.width ?? 0, image.cgImage?.height ?? 0)
    }

    @Test("Images are re-encoded as JPEG with the longest side capped at 1600 px")
    func jpegConversion() {
        let big = UIGraphicsImageRenderer(size: CGSize(width: 2000, height: 1000)).image { ctx in
            UIColor.systemBlue.setFill(); ctx.fill(CGRect(x: 0, y: 0, width: 2000, height: 1000))
        }
        let bigSource = UIImage(data: big.pngData()!)!
        #expect(pixelLongest(bigSource) > 1600) // tiền đề: ảnh nguồn thật sự vượt trần
        let converted = QTChatAttachments.jpegAttachment(fromImageData: big.pngData()!)
        #expect(converted?.mime_type == "image/jpeg")
        let decoded = UIImage(data: Data(base64Encoded: converted!.data)!)!
        #expect(pixelLongest(decoded) <= 1600)
        #expect(pixelLongest(decoded) >= 1595)

        let small = UIGraphicsImageRenderer(size: CGSize(width: 400, height: 300)).image { ctx in
            UIColor.systemRed.setFill(); ctx.fill(CGRect(x: 0, y: 0, width: 400, height: 300))
        }
        let smallSource = UIImage(data: small.pngData()!)!
        #expect(pixelLongest(smallSource) <= 1600)
        let kept = QTChatAttachments.jpegAttachment(fromImageData: small.pngData()!)
        let keptImage = UIImage(data: Data(base64Encoded: kept!.data)!)!
        #expect(pixelLongest(keptImage) == pixelLongest(smallSource)) // dưới trần: giữ nguyên pixel

        #expect(QTChatAttachments.jpegAttachment(fromImageData: Data("not an image".utf8)) == nil)
    }

    @Test("PDF passes through raw but is refused over the per-file cap")
    func pdfPassthrough() {
        let ok = QTChatAttachments.pdfAttachment(from: Data(count: 1024))
        #expect(ok?.mime_type == "application/pdf")
        #expect(ok?.data.count == 1368) // 1024 byte → 1368 ký tự base64
        #expect(QTChatAttachments.pdfAttachment(from: Data(count: 4_600_000)) == nil)
    }

    @Test("Text files are trimmed and capped like the web text path")
    func textContentRules() {
        #expect(QTChatAttachments.textContent(from: Data("  An\nBình  ".utf8)) == "An\nBình")
        #expect(QTChatAttachments.textContent(from: Data("   ".utf8)) == nil)
        let long = QTChatAttachments.textContent(from: Data(String(repeating: "x", count: 5000).utf8))
        #expect(long?.count == QTChatAttachments.maxTextChars)
    }

    @Test("Assemble: 1 file uses `attachment`, many use `attachments`, labels mirror web")
    func assembleShapes() {
        let img = QTStagedAttachment(name: "ds.jpg", attachment: att(10), textContent: nil, thumbnailData: nil)
        let pdf = QTStagedAttachment(name: "ds.pdf", attachment: att(10, mime: "application/pdf"), textContent: nil, thumbnailData: nil)

        let one = QTChatAttachments.assemble(typedText: "", staged: [img])
        #expect(one.attachment != nil && one.attachments == nil)
        #expect(one.text == "🖼️ ds.jpg")

        let two = QTChatAttachments.assemble(typedText: "", staged: [img, pdf])
        #expect(two.attachment == nil && two.attachments?.count == 2)
        #expect(two.text == "🖼️ ds.jpg\n📎 ds.pdf")

        let typed = QTChatAttachments.assemble(typedText: "đây là danh sách", staged: [pdf])
        #expect(typed.text == "đây là danh sách")
        #expect(typed.attachment?.mime_type == "application/pdf")
    }

    @Test("Assemble: text files merge into the message text, never into attachments")
    func assembleTextFile() {
        let txt = QTStagedAttachment(name: "ds.txt", attachment: nil, textContent: "An\nBình", thumbnailData: nil)
        let out = QTChatAttachments.assemble(typedText: "", staged: [txt])
        #expect(out.text == "An\nBình")
        #expect(out.attachment == nil && out.attachments == nil)

        let mixed = QTChatAttachments.assemble(typedText: "gửi kèm", staged: [txt])
        #expect(mixed.text == "gửi kèm\nAn\nBình")
    }
}
