import Foundation
import Supabase

/// Calls the `newsletter-subscribe` edge function (same as the web form).
struct NewsletterRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    struct Result: Decodable {
        let ok: Bool
        let message: String
    }

    private struct Body: Encodable {
        let email: String
        let language: String
        let source: String
    }

    /// Returns the server message on success; throws on failure.
    @discardableResult
    func subscribe(email: String) async throws -> String {
        let result: Result = try await client.functions.invoke(
            "newsletter-subscribe",
            options: FunctionInvokeOptions(
                body: Body(email: email, language: "vi", source: "ios-home")
            )
        )
        guard result.ok else {
            throw NSError(domain: "newsletter", code: 1, userInfo: [NSLocalizedDescriptionKey: result.message])
        }
        return result.message
    }
}
