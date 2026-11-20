import Foundation
import Testing
@testable import ThePickleHub

struct NativeURLTrustTests {
    @Test @MainActor func authCallbacksRequireTrustedTransportAndAuthority() {
        for value in [
            "https://www.thepicklehub.net/auth/callback?code=abc",
            "https://thepicklehub.net:443/auth/callback",
            "thepicklehub://auth/callback?code=abc"
        ] {
            #expect(SessionStore.isAuthCallbackURL(URL(string: value)!))
        }
        for value in [
            "http://www.thepicklehub.net/auth/callback",
            "javascript://www.thepicklehub.net/auth/callback",
            "/auth/callback", "//www.thepicklehub.net/auth/callback",
            "https://user:password@www.thepicklehub.net/auth/callback",
            "https://www.thepicklehub.net:8443/auth/callback",
            "https://www.thepicklehub.net.evil.test/auth/callback",
            "https://evil.test/auth/callback", "https://www.thepicklehub.net/auth/callback/extra",
            "thepicklehub://user@auth/callback", "thepicklehub://auth:443/callback",
            "thepicklehub://auth/other"
        ] {
            #expect(!SessionStore.isAuthCallbackURL(URL(string: value)!))
        }
    }

    @Test func destinationsRequireTrustedTransportAndAuthority() {
        for value in ["https://www.thepicklehub.net/blog/example", "https://thepicklehub.net:443/blog/example", "thepicklehub://blog/example"] {
            #expect(DeepLink.parse(URL(string: value)!) == .blogPost(slug: "example", isVietnamese: false))
        }
        for value in [
            "http://www.thepicklehub.net/blog/example", "javascript://www.thepicklehub.net/blog/example",
            "/blog/example", "//www.thepicklehub.net/blog/example",
            "https://user:password@www.thepicklehub.net/blog/example",
            "https://www.thepicklehub.net:8443/blog/example",
            "https://www.thepicklehub.net.evil.test/blog/example", "https://evil.test/blog/example",
            "https://www.thepicklehub.net/blog/example/extra",
            "thepicklehub://user@blog/example", "thepicklehub://blog:443/example", "thepicklehub://unsupported/example"
        ] {
            #expect(DeepLink.parse(URL(string: value)!) == nil)
        }
    }
}
