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

    /// All venues in a city (web `/san/khu-vuc/:city`), verified/most-courts first.
    func byCity(_ city: String, limit: Int = 500) async throws -> [VenueListItem] {
        try await client.from("venues").select(Self.listColumns)
            .eq("city", value: city)
            .order("is_verified", ascending: false)
            .order("num_courts", ascending: false)
            .order("updated_at", ascending: false)
            .limit(limit).execute().value
    }

    // MARK: Submit (web /san/them — auth insert, is_verified=false pending review)

    private func slugTaken(_ slug: String) async -> Bool {
        struct Row: Decodable { let id: UUID }
        let rows: [Row]? = try? await client.from("venues")
            .select("id").eq("slug", value: slug).limit(1).execute().value
        return !(rows?.isEmpty ?? true)
    }
    private func resolveUniqueSlug(_ base: String) async -> String {
        if !(await slugTaken(base)) { return base }
        for i in 2...10 { let c = "\(base)-\(i)"; if !(await slugTaken(c)) { return c } }
        return "\(base)-\(UUID().uuidString.prefix(4).lowercased())"
    }

    private struct VenueInsert: Encodable {
        let slug: String; let name: String; let address: String; let district: String?
        let city: String; let country = "VN"; let num_courts: Int?; let surface_type: String?
        let is_indoor: Bool; let phone: String?; let website: String?
        let is_verified = false; let created_by: String
    }

    /// Insert a community-submitted venue; returns the resolved slug. Pending
    /// admin review (is_verified=false). Mirrors web VenueSubmit.
    func submitVenue(name: String, address: String, district: String?, city: String,
                     numCourts: Int?, surface: String?, isIndoor: Bool,
                     phone: String?, website: String?) async throws -> String {
        guard let uid = await currentUserID() else {
            throw NSError(domain: "venue", code: 401, userInfo: [NSLocalizedDescriptionKey: "Cần đăng nhập"])
        }
        let base = clubSlugify("\(name) \(city)")
        let slug = await resolveUniqueSlug(base)
        try await client.from("venues").insert(VenueInsert(
            slug: slug, name: name.trimmingCharacters(in: .whitespaces),
            address: address.trimmingCharacters(in: .whitespaces), district: district?.nonEmpty,
            city: city.trimmingCharacters(in: .whitespaces), num_courts: numCourts,
            surface_type: surface?.nonEmpty, is_indoor: isIndoor,
            phone: phone?.nonEmpty, website: website?.nonEmpty,
            created_by: uid.uuidString.lowercased())).execute()
        return slug
    }
}
