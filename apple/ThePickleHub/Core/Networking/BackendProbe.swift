import Foundation
import Supabase

/// Phase 0 connectivity probes. These verify the two riskiest assumptions of the
/// native migration:
///   1. The Supabase client reaches the project (public edge function).
///   2. ES256 user JWT + RLS work end-to-end via PostgREST (authed read).
struct ProbeResult: Identifiable, Equatable {
    let id = UUID()
    let label: String
    let ok: Bool
    let detail: String
}

enum BackendProbe {
    private static var client: SupabaseClient { SupabaseManager.shared.client }

    /// Public, no-auth edge function. Any HTTP reply proves client wiring + network.
    static func publicEdgeFunction() async -> ProbeResult {
        let label = "Edge fn: geo-check"
        do {
            let body: String = try await client.functions.invoke(
                "geo-check",
                options: FunctionInvokeOptions(method: .get)
            ) { data, _ in
                String(data: data, encoding: .utf8) ?? "<binary>"
            }
            return ProbeResult(label: label, ok: true, detail: String(body.prefix(140)))
        } catch {
            return ProbeResult(label: label, ok: false, detail: error.localizedDescription)
        }
    }

    /// Authenticated PostgREST read of the signed-in user's own profile row.
    /// Verifies the user JWT is accepted and RLS lets the user read their row.
    static func authedProfileRead() async -> ProbeResult {
        let label = "Authed read: profiles (self)"
        do {
            let user = try await client.auth.session.user
            let rows: [ProfileIdRow] = try await client
                .from("profiles")
                .select("id")
                .eq("id", value: user.id)
                .limit(1)
                .execute()
                .value
            return ProbeResult(label: label, ok: true, detail: "rows returned = \(rows.count)")
        } catch {
            return ProbeResult(label: label, ok: false, detail: error.localizedDescription)
        }
    }

    private struct ProfileIdRow: Decodable {
        let id: UUID
    }
}
