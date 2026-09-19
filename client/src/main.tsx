import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const legacyHashRoute = window.location.hash.startsWith("#/")
  ? window.location.hash.slice(1)
  : null;

if (legacyHashRoute) {
  window.history.replaceState(null, "", legacyHashRoute);
}

createRoot(document.getElementById("root")!).render(<App />);
