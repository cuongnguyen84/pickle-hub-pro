import Foundation
import Supabase

/// Single shared Supabase client. supabase-swift's Auth verifies ES256 tokens
/// correctly (via the Auth API), so the web app's ES256/HS256 gateway issue
/// does not apply to this native client.
final class SupabaseManager {
    static let shared = SupabaseManager()

    let client: SupabaseClient

    private init() {
        client = SupabaseClient(
            supabaseURL: AppConfig.supabaseURL,
            supabaseKey: AppConfig.supabaseAnonKey
        )
    }
}
