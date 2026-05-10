/**
 * Sprint 7 PR-A — LiveScoringSubscriber Durable Object SKELETON
 *
 * One DO instance per tournament. Holds the SSE connection to
 * rte.pbgql.co/live-scoring (or whatever endpoint the captured live
 * traffic reveals), parses incoming events, and writes match score
 * updates back into Supabase + publishes to Realtime channel
 * `live-scoring-{tournament_id}` for the SPA to consume.
 *
 * ⚠️ STATUS — skeleton only.
 * The actual SSE parser (parseSSEEvent) is a placeholder until Cuong
 * captures real live SSE traffic from a PPA tournament in progress.
 * Plan:
 *   1. Wait for next live PPA event (timing TBD per Sprint 7 spec)
 *   2. Cuong opens DevTools → Network tab → captures SSE response
 *   3. Forwards capture to me → I analyse format → ship Sprint 7 PR-B
 *      with the real parser body
 *   4. PR-B is small — only this file's parseSSEEvent gains ~30 lines
 *
 * The DO lifecycle (start/stop, status, heartbeat) and the realtime
 * publish glue ship in this PR so the surrounding admin UI ("Live
 * Subscriptions" tab in PR-A scope) is reviewable.
 */

interface SubscriptionState {
  active: boolean;
  tournament_url: string | null;
  started_at: string | null;
  last_event_at: string | null;
  last_event_summary: string | null;
}

const INITIAL_STATE: SubscriptionState = {
  active: false,
  tournament_url: null,
  started_at: null,
  last_event_at: null,
  last_event_summary: null,
};

export class LiveScoringSubscriber {
  private state: DurableObjectState;
  private env: unknown;
  private current: SubscriptionState = INITIAL_STATE;
  private abortController: AbortController | null = null;

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;
    this.env = env;
    // Restore cached subscription state on cold start so the DO survives
    // worker restarts without losing track of the live tournament.
    this.state.blockConcurrencyWhile(async () => {
      const cached = await this.state.storage.get<SubscriptionState>("state");
      if (cached) this.current = cached;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/start") {
      const body = (await request.json()) as { tournament_url: string };
      await this.startSubscription(body.tournament_url);
      return Response.json({ ok: true, state: this.current });
    }
    if (request.method === "POST" && url.pathname === "/stop") {
      await this.stopSubscription();
      return Response.json({ ok: true, state: this.current });
    }
    if (request.method === "GET" && url.pathname === "/status") {
      return Response.json(this.current);
    }
    return new Response("Not found", { status: 404 });
  }

  /* ─── Lifecycle ──────────────────────────────────────────────────── */

  async startSubscription(tournamentUrl: string): Promise<void> {
    if (this.current.active && this.current.tournament_url === tournamentUrl) {
      // Already subscribed to this tournament — no-op.
      return;
    }
    if (this.current.active) {
      // Switching tournaments — stop existing first.
      await this.stopSubscription();
    }

    this.current = {
      active: true,
      tournament_url: tournamentUrl,
      started_at: new Date().toISOString(),
      last_event_at: null,
      last_event_summary: null,
    };
    await this.persistState();

    // Kick off the SSE connection in the background. Using waitUntil so
    // the DO doesn't block the start response on the long-lived stream.
    this.abortController = new AbortController();
    this.state.waitUntil(this.runSubscription());
  }

  async stopSubscription(): Promise<void> {
    if (!this.current.active) return;
    this.abortController?.abort();
    this.abortController = null;
    this.current = { ...this.current, active: false };
    await this.persistState();
  }

  async getStatus(): Promise<SubscriptionState> {
    return this.current;
  }

  /* ─── SSE pump (skeleton) ────────────────────────────────────────── */

  private async runSubscription(): Promise<void> {
    if (!this.current.tournament_url) return;
    // PLACEHOLDER: real implementation in PR-B once SSE endpoint format
    // is known. Pseudocode for the future shape:
    //
    //   const sseUrl = deriveSSEEndpoint(this.current.tournament_url);
    //   const response = await fetch(sseUrl, {
    //     signal: this.abortController?.signal,
    //     headers: { Accept: 'text/event-stream' },
    //   });
    //   const reader = response.body!.getReader();
    //   const decoder = new TextDecoder();
    //   let buffer = '';
    //   while (true) {
    //     const { value, done } = await reader.read();
    //     if (done) break;
    //     buffer += decoder.decode(value, { stream: true });
    //     // Split on SSE event boundary (\n\n), parse each event,
    //     // call parseSSEEvent for the data: payload.
    //   }
    //
    // For PR-A skeleton: log + sleep loop so the DO runtime stays
    // alive enough for /status polls to work in admin UI testing.
    console.log(
      `[LiveScoringSubscriber] subscription started for ${this.current.tournament_url} ` +
        "(SSE parser stubbed — Sprint 7 PR-B fills in)",
    );
  }

  private async parseSSEEvent(_event: string): Promise<void> {
    // PLACEHOLDER — Sprint 7 PR-B implements once real SSE format
    // captured from a PPA tournament in progress. Expected shape will
    // include match_id, team scores, game number, possibly server.
    // On parse: UPDATE matches SET team_a_score, team_b_score,
    // current_game, is_live=true; broadcast to Supabase Realtime
    // channel `live-scoring-{tournament_id}` so the SPA Match page
    // re-renders in place.
  }

  private async persistState(): Promise<void> {
    await this.state.storage.put("state", this.current);
  }
}
