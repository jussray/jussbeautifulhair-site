import metaAgentKnowledge from "../client/public/.well-known/jbh-meta-agent.json";
import worker from "./index";

type BaseEnv = Parameters<typeof worker.fetch>[1];
type AnalyticsPoint = {
  blobs?: string[];
  doubles?: number[];
  indexes?: string[];
};
type AnalyticsEngineDatasetBinding = {
  writeDataPoint(point: AnalyticsPoint): void;
};
type Env = BaseEnv & {
  ENABLE_LEGACY_STRIPE_CHECKOUT?: string;
  FUNNEL_ANALYTICS?: AnalyticsEngineDatasetBinding;
};

type FunnelEventName =
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "shopify_handoff"
  | "checkout_error";

type FunnelPayload = {
  event: FunnelEventName;
  productHandle?: string;
  variantId?: string;
  route?: string;
  quantity?: number;
  valueCents?: number;
};

const LEGACY_STRIPE_SESSION_PREFIX = "/api/checkout/session/";
const META_AGENT_KNOWLEDGE_PATH = "/.well-known/jbh-meta-agent.json";
const PUBLIC_BUILD_PROOF_PATH = "/.well-known/jbh-build-proof.json";
const VERSION_PATH = "/version";
const FUNNEL_PATH = "/api/funnel";
const FUNNEL_INDEX = "jbh";
const MAX_FUNNEL_BODY_BYTES = 2 * 1024;
const EXACT_SHA = /^[0-9a-f]{40}$/i;
const SHOPIFY_VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const PRODUCT_HANDLE = /^[a-z0-9][a-z0-9-]{0,119}$/;
const CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ORIGIN = "https://static.cloudflareinsights.com";
const FUNNEL_EVENTS = new Set<FunnelEventName>([
  "product_view",
  "add_to_cart",
  "checkout_start",
  "shopify_handoff",
  "checkout_error",
]);
const FUNNEL_KEYS = new Set([
  "event",
  "productHandle",
  "variantId",
  "route",
  "quantity",
  "valueCents",
]);

function isLegacyStripeCheckout(pathname: string): boolean {
  return pathname === "/api/checkout" || pathname.startsWith(LEGACY_STRIPE_SESSION_PREFIX);
}

function legacyStripeEnabled(env: Env): boolean {
  return env.ENABLE_LEGACY_STRIPE_CHECKOUT?.trim().toLowerCase() === "true";
}

function explicitReleaseSha(env: Env): string | null {
  const candidate = [env.RELEASE_SHA, env.GITHUB_SHA, env.WORKERS_CI_COMMIT_SHA]
    .map((value) => value?.trim().toLowerCase())
    .find((value) => value && EXACT_SHA.test(value));
  return candidate || null;
}

async function buildProofReleaseSha(request: Request, env: Env): Promise<string | null> {
  try {
    const proofUrl = new URL(request.url);
    proofUrl.pathname = PUBLIC_BUILD_PROOF_PATH;
    proofUrl.search = "";
    proofUrl.hash = "";

    const response = await env.ASSETS.fetch(new Request(proofUrl.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    }));
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) return null;

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return null;
    const proof = payload as Record<string, unknown>;
    const sha = typeof proof.sourceCommitSha === "string"
      ? proof.sourceCommitSha.trim().toLowerCase()
      : "";

    if (
      proof.contract !== "jbh-public-build-proof-v1"
      || proof.publicSafe !== true
      || !EXACT_SHA.test(sha)
    ) {
      return null;
    }

    return sha;
  } catch {
    return null;
  }
}

async function versionResponse(request: Request, env: Env): Promise<Response> {
  const sha = explicitReleaseSha(env) || await buildProofReleaseSha(request, env) || "unknown";
  return new Response(
    request.method === "HEAD" ? null : JSON.stringify({ ok: true, sha }),
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function metaAgentKnowledgeResponse(request: Request): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response(
    request.method === "HEAD" ? null : JSON.stringify(metaAgentKnowledge),
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseOptionalString(
  value: unknown,
  maxLength: number,
  pattern?: RegExp,
): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || (pattern && !pattern.test(trimmed))) return null;
  return trimmed;
}

function parseOptionalInteger(
  value: unknown,
  min: number,
  max: number,
): number | undefined | null {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) return null;
  return value as number;
}

function parseFunnelPayload(value: unknown): FunnelPayload | null {
  if (!isRecord(value)) return null;
  if (Object.keys(value).some((key) => !FUNNEL_KEYS.has(key))) return null;
  if (typeof value.event !== "string" || !FUNNEL_EVENTS.has(value.event as FunnelEventName)) {
    return null;
  }

  const productHandle = parseOptionalString(value.productHandle, 120, PRODUCT_HANDLE);
  const variantId = parseOptionalString(value.variantId, 96, SHOPIFY_VARIANT_GID);
  const route = parseOptionalString(value.route, 160, /^\/[A-Za-z0-9/_-]*$/);
  const quantity = parseOptionalInteger(value.quantity, 1, 200);
  const valueCents = parseOptionalInteger(value.valueCents, 0, 100_000_000);

  if (
    productHandle === null
    || variantId === null
    || route === null
    || quantity === null
    || valueCents === null
  ) {
    return null;
  }

  if (
    (value.event === "product_view" || value.event === "add_to_cart")
    && (!productHandle || !variantId)
  ) {
    return null;
  }

  if (value.event === "add_to_cart" && (!quantity || valueCents === undefined)) {
    return null;
  }

  return {
    event: value.event as FunnelEventName,
    productHandle,
    variantId,
    route,
    quantity,
    valueCents,
  };
}

async function funnelResponse(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: "POST",
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const requestUrl = new URL(request.url);
  if (request.headers.get("Origin") !== requestUrl.origin) {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return new Response("Unsupported media type", {
      status: 415,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_FUNNEL_BODY_BYTES) {
    return new Response("Request too large", {
      status: 413,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return new Response("Invalid request", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (new TextEncoder().encode(raw).byteLength > MAX_FUNNEL_BODY_BYTES) {
    return new Response("Request too large", {
      status: 413,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return new Response("Invalid request", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const payload = parseFunnelPayload(decoded);
  if (!payload) {
    return new Response("Invalid event", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const trafficClass = request.headers.get("X-JBH-Traffic-Class") === "proof"
    ? "proof"
    : "human";

  try {
    env.FUNNEL_ANALYTICS?.writeDataPoint({
      indexes: [FUNNEL_INDEX],
      blobs: [
        payload.event,
        payload.productHandle || "",
        payload.variantId || "",
        payload.route || "",
        trafficClass,
      ],
      doubles: [payload.quantity || 0, payload.valueCents || 0],
    });
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.warn(`[FUNNEL] Analytics write failed - ${errorType}`);
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function allowCloudflareWebAnalytics(response: Response): Response {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return response;

  const csp = response.headers.get("content-security-policy");
  if (!csp) return response;

  const existingScriptPolicy = "script-src 'self' https://challenges.cloudflare.com;";
  if (!csp.includes(existingScriptPolicy)) return response;

  const secured = new Response(response.body, response);
  secured.headers.set(
    "Content-Security-Policy",
    csp.replace(
      existingScriptPolicy,
      `script-src 'self' https://challenges.cloudflare.com ${CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ORIGIN};`,
    ),
  );
  return secured;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    if (pathname === VERSION_PATH) {
      return versionResponse(request, env);
    }

    if (pathname === META_AGENT_KNOWLEDGE_PATH) {
      return metaAgentKnowledgeResponse(request);
    }

    if (pathname === FUNNEL_PATH) {
      return funnelResponse(request, env);
    }

    if (isLegacyStripeCheckout(pathname) && !legacyStripeEnabled(env)) {
      return new Response("Not found", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
    }

    return allowCloudflareWebAnalytics(await worker.fetch(request, env));
  },
};
