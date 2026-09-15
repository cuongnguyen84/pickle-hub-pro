/**
 * `matches.notes` is dual-purpose. Organisers and sellers write prose there,
 * but the pro-tour ingest also stores machine state in the same column
 * (`{"live":true}`, set by the live pass) and the MLP importer stores a whole
 * matchup payload there. MatchPage rendered the column raw, so readers got a
 * blob of JSON under a "Ghi chú / Notes" heading on every pro-tour match that
 * had ever been live.
 *
 * Anything that parses as JSON is machine state, so it is not a note.
 */
export function displayNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return null;
    } catch {
      // Not valid JSON after all — a note that happens to open with a brace.
    }
  }
  return trimmed;
}
