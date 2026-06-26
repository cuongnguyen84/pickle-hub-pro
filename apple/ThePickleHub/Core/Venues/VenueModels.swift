import Foundation

// Native models for the court finder (web `/san`). Faithful port of
// `src/lib/venues.ts` types + helpers. App audience is VN → labels default to vi.

struct VenueListItem: Decodable, Identifiable, Equatable {
    let id: UUID
    let slug: String
    let name: String
    let nameVi: String?
    let address: String?
    let district: String?
    let city: String
    let numCourts: Int?
    let surfaceType: String?
    let isIndoor: Bool?
    let coverImageURL: String?
    let isVerified: Bool?

    var displayName: String {
        if let vi = nameVi?.trimmingCharacters(in: .whitespaces), !vi.isEmpty { return vi }
        return name
    }
    var locationLine: String {
        let parts = [district, city].compactMap { $0?.nonEmpty }
        if !parts.isEmpty { return parts.joined(separator: ", ") }
        return address ?? ""
    }
    var courtsLabel: String {
        let c = numCourts ?? 0
        return c <= 0 ? "Chưa rõ số sân" : "\(c) sân"
    }
    var indoorLabel: String? {
        guard let isIndoor else { return nil }
        return isIndoor ? "Trong nhà" : "Ngoài trời"
    }
    var surfaceLabel: String? { VenueSurface.label(surfaceType) }
    var coverURL: URL? { coverImageURL?.nonEmpty.flatMap { WebRoutes.asset($0) } }

    enum CodingKeys: String, CodingKey {
        case id, slug, name, address, district, city
        case nameVi = "name_vi"
        case numCourts = "num_courts"
        case surfaceType = "surface_type"
        case isIndoor = "is_indoor"
        case coverImageURL = "cover_image_url"
        case isVerified = "is_verified"
    }
}

/// Full detail row (`/san/:slug`).
struct VenueDetail: Decodable, Identifiable, Equatable {
    let id: UUID
    let slug: String
    let name: String
    let nameVi: String?
    let address: String?
    let district: String?
    let city: String
    let country: String?
    let latitude: Double?
    let longitude: Double?
    let numCourts: Int?
    let surfaceType: String?
    let isIndoor: Bool?
    let phone: String?
    let website: String?
    let hoursJSON: [String: String]?
    let amenities: [String]?
    let coverImageURL: String?
    let isVerified: Bool?

    var displayName: String {
        if let vi = nameVi?.trimmingCharacters(in: .whitespaces), !vi.isEmpty { return vi }
        return name
    }
    var courtsLabel: String { let c = numCourts ?? 0; return c <= 0 ? "Chưa rõ số sân" : "\(c) sân" }
    var indoorLabel: String? { guard let isIndoor else { return nil }; return isIndoor ? "Trong nhà" : "Ngoài trời" }
    var surfaceLabel: String? { VenueSurface.label(surfaceType) }
    var coverURL: URL? { coverImageURL?.nonEmpty.flatMap { WebRoutes.asset($0) } }

    var fullAddress: String {
        var parts: [String] = []
        for raw in [address, district, city, country] {
            let t = (raw ?? "").trimmingCharacters(in: .whitespaces)
            guard !t.isEmpty else { continue }
            let lower = t.lowercased()
            if parts.contains(where: { $0.lowercased().contains(lower) }) { continue }
            parts.append(t)
        }
        return parts.joined(separator: ", ")
    }

    /// Google Maps directions — coordinates if present, else address query.
    var directionsURL: URL? {
        if let lat = latitude, let lng = longitude {
            return URL(string: "https://www.google.com/maps/dir/?api=1&destination=\(lat),\(lng)")
        }
        let q = (fullAddress.isEmpty ? name : fullAddress).addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "https://www.google.com/maps/search/?api=1&query=\(q)")
    }

    /// Opening hours rows in week order, only days that have a value.
    var hoursRows: [(day: String, value: String)] {
        let order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        let labels = ["mon": "Thứ 2", "tue": "Thứ 3", "wed": "Thứ 4", "thu": "Thứ 5",
                      "fri": "Thứ 6", "sat": "Thứ 7", "sun": "Chủ nhật"]
        guard let hours = hoursJSON else { return [] }
        return order.compactMap { key in
            guard let v = hours[key]?.nonEmpty else { return nil }
            return (labels[key] ?? key, v)
        }
    }

    enum CodingKeys: String, CodingKey {
        case id, slug, name, address, district, city, country, latitude, longitude, phone, website, amenities
        case nameVi = "name_vi"
        case numCourts = "num_courts"
        case surfaceType = "surface_type"
        case isIndoor = "is_indoor"
        case hoursJSON = "hours_json"
        case coverImageURL = "cover_image_url"
        case isVerified = "is_verified"
    }
}

enum VenueSurface {
    private static let labels: [String: String] = [
        "acrylic": "Sơn Acrylic", "hard": "Sân cứng", "asphalt": "Nhựa đường",
        "concrete": "Bê tông", "wood": "Sàn gỗ", "synthetic": "Thảm nhựa tổng hợp", "other": "Khác",
    ]
    static func label(_ value: String?) -> String? {
        guard let value = value?.nonEmpty else { return nil }
        return labels[value.lowercased()] ?? value
    }
}

/// Curated city shortcuts for the "Tìm sân theo khu vực" block (port of the
/// common entries of web VENUE_CITIES).
enum VenueCities {
    static let all: [String] = [
        "TP.HCM", "Hà Nội", "Đà Nẵng", "Đà Lạt", "Nha Trang", "Hải Phòng", "Cần Thơ", "Huế",
        "Bắc Ninh", "Hạ Long", "Vũng Tàu", "Bình Dương",
    ]
}
