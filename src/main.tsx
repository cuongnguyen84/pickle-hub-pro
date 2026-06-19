import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Single-theme migration (P4): load The Line globally so its rules are present
// on every surface (the app-wide data-theme="the-line" lives on <html> in
// index.html). the-line.css's tokens win via :root[data-theme] specificity.
import "./styles/the-line.css";
import { initPwa } from "./pwa";
import { initErrorReporter } from "./lib/errorReporter";

// Wire global error handlers BEFORE rendering so we catch boot-time
// failures (chunk load errors, etc.). Sends to Supabase edge fn
// `log-client-event`; admin can read via /admin/errors or SQL.
initErrorReporter();

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker (skipped inside Capacitor + in dev mode)
initPwa();
