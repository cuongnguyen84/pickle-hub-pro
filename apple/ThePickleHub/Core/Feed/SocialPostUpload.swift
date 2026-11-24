import Foundation
import Supabase

/// The row the create-post edge function returns on success (201). The
/// status comes from the social_posts initial-status trigger: authors
/// with fewer than 3 approved posts land in the moderation queue.
struct CreatedSocialPost: Decodable, Equatable, Sendable {
    let id: String
    let status: String
    let imageURL: String?

    var isPending: Bool { status == "pending" }

    private enum CodingKeys: String, CodingKey {
        case id, status
        case imageURL = "image_url"
    }
}

/// Upload failures, mapped from the create-post function's stable
/// error codes so the composer can show one specific message instead
/// of a generic failure.
enum SocialPostUploadError: Error, Equatable, Sendable {
    case unauthorized
    case imageTooLarge
    case imageTypeNotAllowed
    case imageUndecodable
    case bodyTooLong
    case topicNotAllowed
    case server(code: String)
    case malformedResponse
}

extension SocialPostUploadError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return String(localized: "Bạn cần đăng nhập lại để đăng bài.")
        case .imageTooLarge:
            return String(localized: "Ảnh vượt quá dung lượng cho phép của bài đăng.")
        case .imageTypeNotAllowed:
            return String(localized: "Định dạng ảnh chưa được hỗ trợ cho bài đăng.")
        case .imageUndecodable:
            return String(localized: "Ảnh bị lỗi, vui lòng chọn ảnh khác.")
        case .bodyTooLong:
            return String(localized: "Chú thích quá dài, tối đa 2.000 ký tự.")
        case .topicNotAllowed:
            return String(localized: "Chủ đề chưa hợp lệ, vui lòng chọn lại.")
        case .server, .malformedResponse:
            return String(localized: "Không gửi được bài, vui lòng thử lại sau.")
        }
    }
}

/// Pure request/response plumbing for the create-post edge function,
/// kept free of the network so the multipart shape and the status
/// mapping are unit-testable. The web composer posts the same fields
/// (image file, optional body, optional topic) to the same endpoint.
enum SocialPostUpload {
    static var endpointURL: URL {
        AppConfig.supabaseURL.appendingPathComponent("functions/v1/create-post")
    }

    static func makeRequest(
        image: ProcessedImage,
        body: String,
        topic: SocialPostTopic?,
        accessToken: String,
        boundary: String
    ) -> URLRequest {
        var request = URLRequest(url: endpointURL)
        request.httpMethod = "POST"
        request.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue(
            "multipart/form-data; boundary=\(boundary)",
            forHTTPHeaderField: "Content-Type"
        )
        request.httpBody = multipartBody(
            image: image, body: body, topic: topic, boundary: boundary
        )
        return request
    }

    static func multipartBody(
        image: ProcessedImage,
        body: String,
        topic: SocialPostTopic?,
        boundary: String
    ) -> Data {
        var data = Data()
        func append(_ string: String) {
            data.append(Data(string.utf8))
        }
        append("--\(boundary)\r\n")
        append(
            "Content-Disposition: form-data; name=\"image\"; "
                + "filename=\"post.\(image.fileExtension)\"\r\n"
        )
        append("Content-Type: \(image.contentType)\r\n\r\n")
        data.append(image.data)
        append("\r\n")
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            append("--\(boundary)\r\n")
            append("Content-Disposition: form-data; name=\"body\"\r\n\r\n")
            append("\(trimmed)\r\n")
        }
        if let topic {
            append("--\(boundary)\r\n")
            append("Content-Disposition: form-data; name=\"topic\"\r\n\r\n")
            append("\(topic.rawValue)\r\n")
        }
        append("--\(boundary)--\r\n")
        return data
    }

    static func parse(
        statusCode: Int,
        data: Data
    ) -> Result<CreatedSocialPost, SocialPostUploadError> {
        let decoder = JSONDecoder()
        if statusCode == 201 {
            struct Envelope: Decodable { let post: CreatedSocialPost }
            guard let envelope = try? decoder.decode(Envelope.self, from: data) else {
                return .failure(.malformedResponse)
            }
            return .success(envelope.post)
        }
        struct ErrorEnvelope: Decodable { let error: String }
        let code = (try? decoder.decode(ErrorEnvelope.self, from: data))?.error
            ?? "http_\(statusCode)"
        switch code {
        case "unauthorized":
            return .failure(.unauthorized)
        case "image_too_large", "image_dimensions_too_large":
            return .failure(.imageTooLarge)
        case "image_type_not_allowed":
            return .failure(.imageTypeNotAllowed)
        case "image_undecodable":
            return .failure(.imageUndecodable)
        case "body_too_long":
            return .failure(.bodyTooLong)
        case "topic_not_allowed":
            return .failure(.topicNotAllowed)
        default:
            return .failure(.server(code: code))
        }
    }
}

/// Sends one photo post to the create-post edge function with the
/// current session's access token. The function stores the image and
/// inserts the row; the returned status says whether the post is live
/// or waiting in the moderation queue.
struct SocialPostRepository: Sendable {
    var urlSession: URLSession = .shared

    func createPost(
        image: ProcessedImage,
        body: String,
        topic: SocialPostTopic?
    ) async throws -> CreatedSocialPost {
        let session = try await SupabaseManager.shared.client.auth.session
        let request = SocialPostUpload.makeRequest(
            image: image,
            body: body,
            topic: topic,
            accessToken: session.accessToken,
            boundary: UUID().uuidString
        )
        let (data, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SocialPostUploadError.malformedResponse
        }
        return try SocialPostUpload.parse(
            statusCode: http.statusCode, data: data
        ).get()
    }
}
