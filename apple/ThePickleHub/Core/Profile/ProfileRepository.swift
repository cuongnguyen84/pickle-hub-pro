import Foundation
import Supabase

/// Reads profile rows from Supabase. Fetching the signed-in user's own profile
/// also serves as the end-to-end check that the user JWT + RLS work.
struct ProfileRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let columns = "id,username,display_name,avatar_url,dupr_singles,dupr_doubles"

    /// The signed-in user's own profile.
    func currentUserProfile() async throws -> Profile {
        let userID = try await client.auth.session.user.id
        return try await client
            .from("profiles")
            .select(Self.columns)
            .eq("id", value: userID)
            .single()
            .execute()
            .value
    }
}
