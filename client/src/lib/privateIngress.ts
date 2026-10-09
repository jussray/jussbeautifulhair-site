function parseHttpsEndpoint(raw: string | undefined): URL | null {
  const configured = raw?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !local) return null;
    return url;
  } catch {
    return null;
  }
}

export function getContactEndpoint(): string | null {
  return parseHttpsEndpoint(import.meta.env.VITE_CONTACT_API_URL)?.toString() || null;
}

export function getNewsletterEndpoint(): string | null {
  const configured = parseHttpsEndpoint(import.meta.env.VITE_CONTACT_API_URL);
  if (!configured) return null;

  configured.pathname = "/newsletter";
  configured.search = "";
  configured.hash = "";
  return configured.toString();
}
