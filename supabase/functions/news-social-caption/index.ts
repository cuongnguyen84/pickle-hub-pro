// New deployment slug for the Facebook caption service. The legacy
// social-caption deployment is stuck in Supabase's imported-function 409
// state; importing the canonical implementation keeps one source of truth.
import "../social-caption/index.ts";
