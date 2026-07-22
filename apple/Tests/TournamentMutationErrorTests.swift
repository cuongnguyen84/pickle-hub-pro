import Foundation
import Testing
@testable import ThePickleHub

@Suite("Transactional tournament mutation errors")
struct TournamentMutationErrorTests {
    @Test("optimistic conflict has an actionable reload message")
    func versionConflict() {
        let error = TournamentMutationError(code: "VERSION_CONFLICT")
        #expect(error == .versionConflict)
        #expect(error.errorDescription?.contains("tải lại") == true)
    }

    @Test("played downstream result is never presented as a generic server error")
    func downstreamLocked() {
        let error = TournamentMutationError(code: "DOWNSTREAM_LOCKED")
        #expect(error == .downstreamLocked)
        #expect(error.errorDescription?.contains("trận phụ thuộc") == true)
    }

    @Test("unknown backend codes remain visible for diagnostics")
    func unknownCode() {
        let error = TournamentMutationError(code: "NEW_BACKEND_CODE")
        #expect(error == .server("NEW_BACKEND_CODE"))
        #expect(error.errorDescription?.contains("NEW_BACKEND_CODE") == true)
    }

    @Test("typed RPC envelope throws its typed error")
    func envelope() throws {
        let json = #"{"success":false,"error":"BRACKET_CONFLICT","current_version":3}"#.data(using: .utf8)!
        let result = try JSONDecoder().decode(AtomicTournamentMutationResult.self, from: json)
        #expect(throws: TournamentMutationError.bracketConflict) {
            try result.requireSuccess()
        }
    }
}
