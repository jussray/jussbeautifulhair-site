export function getCheckoutSessionId(search: string, hash: string): string | undefined {
  const fromSearch = new URLSearchParams(search).get("session_id")?.trim();
  if (fromSearch) return fromSearch;

  const queryStart = hash.indexOf("?");
  if (queryStart < 0) return undefined;

  const fromHash = new URLSearchParams(hash.slice(queryStart + 1))
    .get("session_id")
    ?.trim();

  return fromHash || undefined;
}
