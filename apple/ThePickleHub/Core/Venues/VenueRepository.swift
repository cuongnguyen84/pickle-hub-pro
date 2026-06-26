import Foundation
import Supabase

/// Reads the `venues` table (public-read). Mirrors web `/san` queries:
/// verified-first ordering, 300ms-debounced ILIKE search across name fields.
struct VenueRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let listColumns =
        "id, slug, name, name_vi, address, district, city, num_courts, surface_type, is_indoor, cover_image_url, is_verified"
    private static let detailColumns =
        "id, slug, name, name_vi, address, district, city, country, latitude, longitude, num_courts, surface_type, is_indoor, phone, website, hours_json, amenities, cover_image_url, is_verified"

    /// Sanitize ILIKE input (drop wildcard/operator chars), like web escapePostgrestSearch.
    private static func sanitize(_ q: String) -> String {
        let cleaned = q.unicodeScalars.map { CharacterSet(charactersIn: ",.()*\"%_").contains($0) ? " " : Character($0) }
        return String(cleaned).replacingOccurrences(of: "  ", with: " ").trimmingCharacters(in: .whitespaces)
    }

    func list(search: String = "", limit: Int = 60) async throws -> [VenueListItem] {
        var query = client.from("venues").select(Self.listColumns)
        let safe = Self.sanitize(search)
        if !safe.isEmpty {
            let pat = "%\(safe)%"
            query = query.or("name.ilike.\(pat),name_vi.ilike.\(pat),address.ilike.\(pat),district.ilike.\(pat),city.ilike.\(pat)")
        }
        return try await query
            .order("is_verified", ascending: false)
            .order("num_courts", ascending: false)
            .order("updated_at", ascending: false)
            .limit(limit).execute().value
    }

    func detail(slug: String) async throws -> VenueDetail {
        try await client.from("venues").select(Self.detailColumns)
            .eq("slug", value: slug).single().execute().value
    }

    /// Other venues in the same city (for the detail "nearby" block).
    func nearby(city: String, excludingSlug: String, limit: Int = 8) async -> [VenueListItem] {
        (try? await client.from("venues").select(Self.listColumns)
            .eq("city", value: city).neq("slug", value: excludingSlug)
            .order("is_verified", ascending: false).order("num_courts", ascending: false)
            .limit(limit).execute().value) ?? []
    }

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }
}
