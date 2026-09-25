import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function migrateLegacyHashRoute() {
  const legacyHashRoute = window.location.hash.startsWith("#/")
    ? window.location.hash.slice(1)
    : null;

  if (legacyHashRoute) {
    window.history.replaceState(null, "", legacyHashRoute);
  }
}

migrateLegacyHashRoute();
// Same-document hash edits (old links, typed URLs) must migrate too; wouter
// observes replaceState, so the router follows without a reload.
window.addEventListener("hashchange", migrateLegacyHashRoute);

const legacyShopifyProductRoute = window.location.pathname.match(/^\/products\/([^/]+)\/?$/);

if (legacyShopifyProductRoute) {
  const [, handle] = legacyShopifyProductRoute;
  window.history.replaceState(
    null,
    "",
    `/product/${handle}${window.location.search}${window.location.hash}`,
  );
}

createRoot(document.getElementById("root")!).render(<App />);
