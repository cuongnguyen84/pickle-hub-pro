import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPwa } from "./pwa";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker (skipped inside Capacitor + in dev mode)
initPwa();
