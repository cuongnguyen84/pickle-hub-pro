import Foundation
import Testing
@testable import ThePickleHub

// Create-post upload plumbing (PR-N2): the multipart shape the edge
// function expects and the mapping of its stable error codes.

struct SocialPostComposerTests {
    private let image = ProcessedImage(
        data: Data([0xFF, 0xD8, 0xFF, 0x00, 0xFF, 0xD9]),
        fileExtension: "jpg",
        contentType: "image/jpeg",
        pixelWidth: 640,
        pixelHeight: 480
    )

    // MARK: - Multipart body

    @Test func multipartCarriesImageBodyAndTopic() {
        let data = SocialPostUpload.multipartBody(
            image: image, body: "  Xin chào  ", topic: .findPartners,
            boundary: "TESTBOUNDARY"
        )
        let text = String(decoding: data, as: UTF8.self)
        #expect(text.contains("--TESTBOUNDARY\r\n"))
        #expect(text.contains("name=\"image\"; filename=\"post.jpg\""))
        #expect(text.contains("Content-Type: image/jpeg"))
        #expect(text.contains("name=\"body\"\r\n\r\nXin chào\r\n"))
        #expect(text.contains("name=\"topic\"\r\n\r\ntim-ban-danh\r\n"))
        #expect(text.hasSuffix("--TESTBOUNDARY--\r\n"))
        // The raw image bytes ride between the image headers and the
        // next boundary.
        #expect(data.range(of: image.data) != nil)
    }

    @Test func multipartOmitsEmptyBodyAndMissingTopic() {
        let data = SocialPostUpload.multipartBody(
            image: image, body: "   ", topic: nil, boundary: "B"
        )
        let text = String(decoding: data, as: UTF8.self)
        #expect(!text.contains("name=\"body\""))
        #expect(!text.contains("name=\"topic\""))
        #expect(text.hasSuffix("--B--\r\n"))
    }

    // MARK: - Request

    @Test func requestTargetsTheFunctionWithAuthHeaders() {
        let request = SocialPostUpload.makeRequest(
            image: image, body: "", topic: nil,
            accessToken: "TOKEN123", boundary: "B"
        )
        #expect(request.httpMethod == "POST")
        #expect(
            request.url?.absoluteString.hasSuffix("/functions/v1/create-post") == true
        )
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer TOKEN123")
        #expect(request.value(forHTTPHeaderField: "apikey") == AppConfig.supabaseAnonKey)
        #expect(
            request.value(forHTTPHeaderField: "Content-Type")
                == "multipart/form-data; boundary=B"
        )
        #expect(request.httpBody != nil)
    }

    // MARK: - Response parsing

    @Test func parseCreatedApproved() {
        let json = #"{"post":{"id":"p1","status":"approved","image_url":"https://x/y.jpg"}}"#
        let result = SocialPostUpload.parse(statusCode: 201, data: Data(json.utf8))
        #expect(result == .success(
            CreatedSocialPost(id: "p1", status: "approved", imageURL: "https://x/y.jpg")
        ))
        if case .success(let post) = result {
            #expect(!post.isPending)
        } else {
            Issue.record("expected success")
        }
    }

    @Test func parseCreatedPending() {
        let json = #"{"post":{"id":"p2","status":"pending","image_url":null}}"#
        let result = SocialPostUpload.parse(statusCode: 201, data: Data(json.utf8))
        if case .success(let post) = result {
            #expect(post.isPending)
            #expect(post.imageURL == nil)
        } else {
            Issue.record("expected success, got \(result)")
        }
    }

    @Test func parseErrorCodes() {
        func code(_ status: Int, _ body: String) -> SocialPostUploadError? {
            if case .failure(let error) = SocialPostUpload.parse(
                statusCode: status, data: Data(body.utf8)
            ) {
                return error
            }
            return nil
        }
        #expect(code(401, #"{"error":"unauthorized"}"#) == .unauthorized)
        #expect(code(413, #"{"error":"image_too_large"}"#) == .imageTooLarge)
        #expect(code(413, #"{"error":"image_dimensions_too_large"}"#) == .imageTooLarge)
        #expect(code(415, #"{"error":"image_type_not_allowed"}"#) == .imageTypeNotAllowed)
        #expect(code(415, #"{"error":"image_undecodable"}"#) == .imageUndecodable)
        #expect(code(400, #"{"error":"body_too_long"}"#) == .bodyTooLong)
        #expect(code(400, #"{"error":"topic_not_allowed"}"#) == .topicNotAllowed)
        #expect(code(502, #"{"error":"upload_failed"}"#) == .server(code: "upload_failed"))
        #expect(code(500, "not json") == .server(code: "http_500"))
    }

    @Test func parseMalformedSuccess() {
        let result = SocialPostUpload.parse(
            statusCode: 201, data: Data("{}".utf8)
        )
        #expect(result == .failure(.malformedResponse))
    }
}
