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

export function resolveNewsletterEndpoint(
  newsletterUrl: string | undefined,
  contactUrl: string | undefined,
): string | null {
  const configured = parseHttpsEndpoint(newsletterUrl);
  const contact = parseHttpsEndpoint(contactUrl);
  if (
    !configured ||
    !contact ||
    configured.pathname !== "/newsletter" ||
    configured.origin !== contact.origin ||
    configured.username ||
    configured.password
  ) return null;

  configured.pathname = "/newsletter";
  configured.search = "";
  configured.hash = "";
  return configured.toString();
}

export function getNewsletterEndpoint(): string | null {
  // The public Worker's CSP permits the separately authorized contact ingress.
  // A newsletter endpoint on any other origin remains unavailable.
  return resolveNewsletterEndpoint(
    import.meta.env.VITE_NEWSLETTER_API_URL,
    import.meta.env.VITE_CONTACT_API_URL,
  );
}
