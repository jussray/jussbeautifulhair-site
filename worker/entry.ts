import worker from "./index";

type BaseEnv = Parameters<typeof worker.fetch>[1];
type Env = BaseEnv & {
  ENABLE_LEGACY_STRIPE_CHECKOUT?: string;
};

const LEGACY_STRIPE_SESSION_PREFIX = "/api/checkout/session/";

function isLegacyStripeCheckout(pathname: string): boolean {
  return pathname === "/api/checkout" || pathname.startsWith(LEGACY_STRIPE_SESSION_PREFIX);
}

function legacyStripeEnabled(env: Env): boolean {
  return env.ENABLE_LEGACY_STRIPE_CHECKOUT?.trim().toLowerCase() === "true";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;

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
