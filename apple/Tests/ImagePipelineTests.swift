import ImageIO
import Testing
import UIKit
@testable import ThePickleHub

@Suite("Image pipeline")
struct ImagePipelineTests {
    @Test("JPEG output is downsized, bounded and consistently typed")
    func jpegIsDownsizedAndTyped() throws {
        let source = try #require(makeImage(size: CGSize(width: 3_200, height: 1_600), opaque: true).jpegData(compressionQuality: 1))
        let policy = ImageProcessingPolicy(maxPixelDimension: 900, maxOutputBytes: 400_000,
                                           maxInputBytes: 20_000_000, maxInputPixelCount: 20_000_000)

        let result = try ImagePipeline.process(source, policy: policy)

        #expect(result.fileExtension == "jpg")
        #expect(result.contentType == "image/jpeg")
        #expect(max(result.pixelWidth, result.pixelHeight) <= 900)
        #expect(result.data.count <= 400_000)
        #expect(CGImageSourceGetType(CGImageSourceCreateWithData(result.data as CFData, nil)!) as String? == "public.jpeg")
    }

    @Test("Transparent images remain PNG with matching MIME type")
    func transparentImageStaysPNG() throws {
        let source = try #require(makeImage(size: CGSize(width: 400, height: 300), opaque: false).pngData())
        let result = try ImagePipeline.process(source, policy: .avatar)

        #expect(result.fileExtension == "png")
        #expect(result.contentType == "image/png")
        #expect(CGImageSourceGetType(CGImageSourceCreateWithData(result.data as CFData, nil)!) as String? == "public.png")
    }

    @Test("Invalid and oversized inputs fail before upload")
    func invalidInputsFail() {
        #expect(throws: ImagePipelineError.noData) {
            try ImagePipeline.process(Data(), policy: .avatar)
        }
        let policy = ImageProcessingPolicy(maxPixelDimension: 1_024, maxOutputBytes: 1_024,
                                           maxInputBytes: 3, maxInputPixelCount: 1_000)
        #expect(throws: ImagePipelineError.inputTooLarge) {
            try ImagePipeline.process(Data([0, 1, 2, 3]), policy: policy)
        }
    }

    private func makeImage(size: CGSize, opaque: Bool) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.opaque = opaque
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            if opaque {
                UIColor.systemBlue.setFill()
                context.fill(CGRect(origin: .zero, size: size))
            } else {
                UIColor.clear.setFill()
                context.fill(CGRect(origin: .zero, size: size))
                UIColor.systemGreen.withAlphaComponent(0.65).setFill()
                context.cgContext.fillEllipse(in: CGRect(x: 20, y: 20, width: 220, height: 180))
            }
        }
    }
}
