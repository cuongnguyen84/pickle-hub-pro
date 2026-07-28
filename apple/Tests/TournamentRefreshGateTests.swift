import Testing
@testable import ThePickleHub

struct TournamentRefreshGateTests {
    @Test @MainActor
    func overlappingRefreshesRunOneFreshPassAfterTheInflightRequest() async {
        let gate = TournamentRefreshGate()
        var runs = 0
        var releaseFirst: CheckedContinuation<Void, Never>?

        let first = Task { @MainActor in
            await gate.perform {
                runs += 1
                await withCheckedContinuation { continuation in
                    releaseFirst = continuation
                }
            }
        }

        while runs == 0 {
            await Task.yield()
        }

        let second = Task { @MainActor in
            await gate.perform {
                runs += 1
            }
        }

        await Task.yield()
        #expect(runs == 1)
        releaseFirst?.resume()

        await first.value
        await second.value
        #expect(runs == 2)
    }

    @Test @MainActor
    func completedRefreshesRunNormally() async {
        let gate = TournamentRefreshGate()
        var runs = 0

        await gate.perform { runs += 1 }
        await gate.perform { runs += 1 }

        #expect(runs == 2)
    }
}
