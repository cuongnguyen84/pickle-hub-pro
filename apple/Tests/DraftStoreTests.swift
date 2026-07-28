import Foundation
import Testing
@testable import ThePickleHub

/// UX-04 draft autosave — envelope round-trip, version gate, guard chống
/// hồi sinh draft đã clear, và ranh giới D3 (bank fields không vào snapshot).
@MainActor
struct DraftStoreTests {
    private struct Snap: Codable, Equatable { var name: String; var count: Int }

    private func makeStore(_ suite: String) -> (DraftStore<Snap>, UserDefaults) {
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return (DraftStore<Snap>(flow: "test", defaults: defaults), defaults)
    }

    @Test func flushThenRestoreRoundTrips() {
        let (store, _) = makeStore("draft-test-roundtrip")
        #expect(store.key == "draft:test:new")
        #expect(store.restore() == nil)
        store.flush(Snap(name: "Giải test", count: 3))
        #expect(store.restore() == Snap(name: "Giải test", count: 3))
        #expect(store.lastSavedAt != nil)
    }

    @Test func schemaVersionMismatchIsIgnored() {
        let (store, defaults) = makeStore("draft-test-version")
        let alien = #"{"v":99,"savedAt":0,"data":{"name":"x","count":1}}"#
        defaults.set(Data(alien.utf8), forKey: store.key)
        #expect(store.restore() == nil)
        // Rác không parse được cũng bị bỏ qua.
        defaults.set(Data("not json".utf8), forKey: store.key)
        #expect(store.restore() == nil)
    }

    @Test func clearRemovesAndBlocksResurrection() {
        let (store, _) = makeStore("draft-test-clear")
        let snap = Snap(name: "a", count: 1)
        store.flush(snap)
        store.clear(current: snap)
        #expect(store.restore() == nil)
        #expect(store.lastSavedAt == nil)
        // Flush lại đúng giá trị lúc clear → không được ghi (hồi sinh draft).
        store.flush(snap)
        #expect(store.restore() == nil)
        // Giá trị MỚI sau clear → lưu bình thường.
        store.flush(Snap(name: "b", count: 2))
        #expect(store.restore() == Snap(name: "b", count: 2))
    }

    /// Ranh giới D3/CodeQL: snapshot của các wizard có bước lệ phí tuyệt đối
    /// không chứa trường tài khoản ngân hàng.
    @Test func snapshotsExcludeBankFields() throws {
        let tm = CreateTeamMatchModel()
        tm.bankCode = "VCB"; tm.bankAccountNumber = "0123456789"; tm.bankAccountName = "NGUYEN VAN A"
        let tmJson = String(decoding: try JSONEncoder().encode(tm.draftSnapshot), as: UTF8.self).lowercased()
        #expect(!tmJson.contains("bank"))
        #expect(!tmJson.contains("0123456789"))

        let social = SocialEventFormModel(existing: nil, clubID: UUID())
        social.bankCode = "VCB"; social.bankAccountNumber = "0123456789"; social.bankAccountName = "NGUYEN VAN A"
        let socialJson = String(decoding: try JSONEncoder().encode(social.draftSnapshot), as: UTF8.self).lowercased()
        #expect(!socialJson.contains("bank"))
        #expect(!socialJson.contains("0123456789"))
    }

    @Test func teamMatchApplyRestoresFieldsAndClampsStep() {
        let m = CreateTeamMatchModel()
        var d = m.draftSnapshot
        d.name = "MLP Test"; d.step = 9; d.rosterSize = 6; d.format = "rr_playoff"
        d.templates = [.init(gameType: "MX", displayName: "MX 1", scoringType: "rally21")]
        m.apply(d)
        #expect(m.name == "MLP Test")
        #expect(m.step == 5)          // clamp 1...5
        #expect(m.rosterSize == 6)
        #expect(m.format == "rr_playoff")
        #expect(m.templates.count == 1)
        #expect(m.bankCode.isEmpty)   // bank không bao giờ restore từ draft
    }
}
