import Foundation
import ImageIO
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct ProcessedImage: Equatable, Sendable {
    let data: Data
    let fileExtension: String
    let contentType: String
    let pixelWidth: Int
    let pixelHeight: Int
}

struct ImageProcessingPolicy: Equatable, Sendable {
    let maxPixelDimension: Int
    let maxOutputBytes: Int
    let maxInputBytes: Int
    let maxInputPixelCount: Int

    static let avatar = ImageProcessingPolicy(
        maxPixelDimension: 1_024,
        maxOutputBytes: 2 * 1_024 * 1_024,
        maxInputBytes: 30 * 1_024 * 1_024,
        maxInputPixelCount: 80_000_000
    )

    static let clubLogo = avatar

    static let forum = ImageProcessingPolicy(
        maxPixelDimension: 2_048,
        maxOutputBytes: 4 * 1_024 * 1_024,
        maxInputBytes: 30 * 1_024 * 1_024,
        maxInputPixelCount: 80_000_000
    )
}

enum ImagePipelineError: LocalizedError, Equatable {
    case noData
    case inputTooLarge
    case invalidImage
    case dimensionsTooLarge
    case encodingFailed
    case outputTooLarge

    var errorDescription: String? {
        switch self {
        case .noData:
            return String(localized: "Không đọc được ảnh đã chọn.")
        case .inputTooLarge:
            return String(localized: "Ảnh gốc quá lớn. Vui lòng chọn ảnh dưới 30 MB.")
        case .invalidImage:
            return String(localized: "Định dạng ảnh không hợp lệ hoặc ảnh đã bị hỏng.")
        case .dimensionsTooLarge:
            return String(localized: "Kích thước ảnh vượt giới hạn an toàn.")
        case .encodingFailed:
            return String(localized: "Không thể xử lý ảnh. Vui lòng thử ảnh khác.")
        case .outputTooLarge:
            return String(localized: "Không thể giảm ảnh xuống dung lượng cho phép.")
        }
    }
}

/// Shared image boundary for every PhotosPicker upload. It applies orientation,
/// strips source metadata, downsizes oversized images and emits bytes whose file
/// extension and MIME type always agree.
enum ImagePipeline {
    static func load(_ item: PhotosPickerItem, policy: ImageProcessingPolicy) async throws -> ProcessedImage {
        guard let data = try await item.loadTransferable(type: Data.self) else {
            throw ImagePipelineError.noData
        }
        return try await Task.detached(priority: .userInitiated) {
            try process(data, policy: policy)
        }.value
    }

    static func load(
        _ items: [PhotosPickerItem],
        limit: Int,
        policy: ImageProcessingPolicy
    ) async throws -> [ProcessedImage] {
        var images: [ProcessedImage] = []
        for item in items.prefix(limit) {
            try Task.checkCancellation()
            images.append(try await load(item, policy: policy))
        }
        return images
    }

    static func process(_ data: Data, policy: ImageProcessingPolicy) throws -> ProcessedImage {
        guard !data.isEmpty else { throw ImagePipelineError.noData }
        guard data.count <= policy.maxInputBytes else { throw ImagePipelineError.inputTooLarge }
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceGetCount(source) > 0,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              width > 0,
              height > 0 else {
            throw ImagePipelineError.invalidImage
        }

        let (pixelCount, overflow) = width.multipliedReportingOverflow(by: height)
        guard !overflow, pixelCount <= policy.maxInputPixelCount else {
            throw ImagePipelineError.dimensionsTooLarge
        }

        var targetDimension = min(max(width, height), policy.maxPixelDimension)
        let minimumDimension = min(256, targetDimension)

        while targetDimension >= minimumDimension {
            guard let image = thumbnail(from: source, maxPixelDimension: targetDimension) else {
                throw ImagePipelineError.invalidImage
            }

            let hasAlpha = image.hasAlphaChannel
            let attempts: [(UTType, String, String, CGFloat?)] = hasAlpha
                ? [(.png, "png", "image/png", nil)]
                : [
                    (.jpeg, "jpg", "image/jpeg", 0.86),
                    (.jpeg, "jpg", "image/jpeg", 0.72),
                    (.jpeg, "jpg", "image/jpeg", 0.58)
                ]

            for (type, ext, contentType, quality) in attempts {
                let encoded = try encode(image, type: type, quality: quality)
                if encoded.count <= policy.maxOutputBytes {
                    return ProcessedImage(
                        data: encoded,
                        fileExtension: ext,
                        contentType: contentType,
                        pixelWidth: image.width,
                        pixelHeight: image.height
                    )
                }
            }

            let next = Int((Double(targetDimension) * 0.78).rounded(.down))
            guard next < targetDimension else { break }
            targetDimension = next
        }

        throw ImagePipelineError.outputTooLarge
    }

    private static func thumbnail(from source: CGImageSource, maxPixelDimension: Int) -> CGImage? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelDimension
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }

    private static func encode(_ image: CGImage, type: UTType, quality: CGFloat?) throws -> Data {
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            output,
            type.identifier as CFString,
            1,
            nil
        ) else {
            throw ImagePipelineError.encodingFailed
        }

        var properties: [CFString: Any] = [:]
        if let quality { properties[kCGImageDestinationLossyCompressionQuality] = quality }
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
        guard CGImageDestinationFinalize(destination) else {
            throw ImagePipelineError.encodingFailed
        }
        return output as Data
    }
}

private extension CGImage {
    var hasAlphaChannel: Bool {
        switch alphaInfo {
        case .none, .noneSkipFirst, .noneSkipLast:
            return false
        case .premultipliedFirst, .premultipliedLast, .first, .last, .alphaOnly:
            return true
        @unknown default:
            return true
        }
    }
}
