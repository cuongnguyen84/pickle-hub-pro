import Testing
@testable import ThePickleHub

struct AppleAuthServiceTests {
    @Test func sha256MatchesKnownDigest() {
        #expect(
            AppleSignInNonce.sha256("abc")
                == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        )
    }

    @Test func secureNonceHasExpectedLengthAndAlphabet() throws {
        let nonce = try AppleSignInNonce.generate(length: 48)
        let allowed = Set("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")

        #expect(nonce.count == 48)
        #expect(nonce.allSatisfy(allowed.contains))
    }
}
