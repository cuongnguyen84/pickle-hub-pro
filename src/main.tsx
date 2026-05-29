import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPwa } from "./pwa";
import { initErrorReporter } from "./lib/errorReporter";

// Wire global error handlers BEFORE rendering so we catch boot-time
// failures (chunk load errors, etc.). Sends to Supabase edge fn
// `log-client-event`; admin can read via /admin/errors or SQL.
initErrorReporter();

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker (skipped inside Capacitor + in dev mode)
initPwa();
