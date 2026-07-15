import Foundation
import Testing
@testable import ThePickleHub

struct DeepLinkTests {

    private func parse(_ s: String) -> DeepLink? { URL(string: s).flatMap(DeepLink.parse) }

    @Test func universalLinkRegistration() {
        let token = "0a1b2c3d-0000-1111-2222-333344445555"
        #expect(parse("https://www.thepicklehub.net/dang-ky/\(token)") == .registration(token: token))
        #expect(parse("https://thepicklehub.net/vi/dang-ky/\(token)") == .registration(token: token))
        // Token viết hoa → normalize lowercase.
        #expect(parse("https://www.thepicklehub.net/dang-ky/\(token.uppercased())") == .registration(token: token))
    }

    @Test func customScheme() {
        let token = "0a1b2c3d-0000-1111-2222-333344445555"
        #expect(parse("thepicklehub://dang-ky/\(token)") == .registration(token: token))
        #expect(parse("thepicklehub://join/abc123") == .joinInvite(code: "abc123"))
        #expect(parse("thepicklehub://social/keo-toi-t7") == .socialEvent(slug: "keo-toi-t7"))
    }

    @Test func rejectsInvalid() {
        #expect(parse("https://www.thepicklehub.net/dang-ky/khong-phai-uuid") == nil)   // token không phải UUID
        #expect(parse("https://evil.com/dang-ky/0a1b2c3d-0000-1111-2222-333344445555") == nil) // host lạ
        #expect(parse("https://www.thepicklehub.net/social/x/danh-sach") == nil)        // sub-path organizer
        #expect(parse("https://www.thepicklehub.net/blog/abc") == nil)                  // route không hỗ trợ
        // URL Google Sign-In không được nuốt (để GIDSignIn xử lý).
        #expect(parse("com.googleusercontent.apps.574564887581-qhno3m28725a9c0c91tl2qp71fdv0lli://oauth") == nil)
    }

    @Test func joinUniversalLink() {
        #expect(parse("https://www.thepicklehub.net/join/XYZ789") == .joinInvite(code: "XYZ789"))
    }
}
