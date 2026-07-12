import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installJbhGuardrailRuntime } from "./config/visionGuardrails";

installJbhGuardrailRuntime();

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
