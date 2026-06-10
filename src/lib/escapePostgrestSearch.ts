// Shared PostgREST search sanitiser.
//
// PostgREST's `.or(...)` filter grammar treats `,` as a condition separator and
// `()`, `*`, `.`, `"` as part of the filter syntax, while `%` and `_` are SQL
// ILIKE wildcards. Interpolating raw user input into an `.or("col.ilike.%x%")`
// string therefore lets a stray comma or paren split the query into extra/invalid
// OR conditions (broken results, malformed requests), and a literal `%`/`_`
// matches far more than intended.
//
// This collapses all of those characters to spaces so user input is always a
// safe literal fragment. Originally duplicated in ClubsList.tsx / VenuesList.tsx;
// lifted to src/lib so every search call site can reuse one proven helper.
export function escapePostgrestSearch(input: string): string {
  return input
    .replace(/[,.()*"%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
