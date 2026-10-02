export type RateLimitBinding = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

type RateLimitEnv = {
  JBH_RATE_LIMITER?: RateLimitBinding;
};

const RETRY_AFTER_SECONDS = 60;

export function isJbhDynamicPath(pathname: string): boolean {
  return pathname === "/version"
    || pathname === "/api"
    || pathname.startsWith("/api/");
}

function rateLimitKey(request: Request): string {
  const connectingIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (connectingIp) return `ip:${connectingIp}`;

  const forwardedIp = (request.headers.get("X-Forwarded-For") || "")
    .split(",")[0]
    .trim();
  if (forwardedIp) return `ip:${forwardedIp}`;

  return "ip:unknown";
}

function json(status: number, body: Record<string, unknown>, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export async function enforceJbhRateLimit(
  request: Request,
  env: RateLimitEnv,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (!isJbhDynamicPath(pathname)) return null;

  const limiter = env.JBH_RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== "function") {
    return json(503, { error: "rate_limit_unavailable" }, { "Retry-After": String(RETRY_AFTER_SECONDS) });
  }

  const { success } = await limiter.limit({ key: rateLimitKey(request) });
  if (success) return null;

  return json(429, { error: "rate_limit_exceeded" }, { "Retry-After": String(RETRY_AFTER_SECONDS) });
}
