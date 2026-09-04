import metaAgentKnowledge from "../client/public/.well-known/jbh-meta-agent.json";
import worker from "./index";

type BaseEnv = Parameters<typeof worker.fetch>[1];
type Env = BaseEnv & {
  ENABLE_LEGACY_STRIPE_CHECKOUT?: string;
};

const LEGACY_STRIPE_SESSION_PREFIX = "/api/checkout/session/";
const META_AGENT_KNOWLEDGE_PATH = "/.well-known/jbh-meta-agent.json";
const PUBLIC_BUILD_PROOF_PATH = "/.well-known/jbh-build-proof.json";
const VERSION_PATH = "/version";
const EXACT_SHA = /^[0-9a-f]{40}$/i;

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    if (pathname === VERSION_PATH) {
      return versionResponse(request, env);
    }

    if (pathname === META_AGENT_KNOWLEDGE_PATH) {
      return metaAgentKnowledgeResponse(request);
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

    return worker.fetch(request, env);
  },
};
