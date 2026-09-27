import storefrontWorker from './entry';
import { invokeJbhProvider, jbhProviderStates } from './provider-runtime';

type ProviderEnv = Parameters<typeof storefrontWorker.fetch>[1] & {
  JBH_AI_OPERATOR_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  MODEL_API_KEY?: string;
  JBH_OPENAI_MODEL?: string;
  JBH_ANTHROPIC_MODEL?: string;
  JBH_MUSE_MODEL?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function operatorAuthorized(request: Request, env: ProviderEnv): boolean {
  if (!env.JBH_AI_OPERATOR_KEY) return false;
  const direct = request.headers.get('x-jbh-ai-key');
  const bearer = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
  return (direct || bearer || '') === env.JBH_AI_OPERATOR_KEY;
}

export default {
  async fetch(request: Request, env: ProviderEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/internal/providers' && request.method === 'GET') {
      if (!env.JBH_AI_OPERATOR_KEY) return json({ error: 'AI operator lane is not configured' }, 503);
      if (!operatorAuthorized(request, env)) return json({ error: 'Unauthorized' }, 401);
      return json({ service: 'jussbeautifulhair-site', providers: jbhProviderStates(env), authority: 'none' });
    }

    if (url.pathname === '/api/internal/providers/invoke' && request.method === 'POST') {
      if (!env.JBH_AI_OPERATOR_KEY) return json({ error: 'AI operator lane is not configured' }, 503);
      if (!operatorAuthorized(request, env)) return json({ error: 'Unauthorized' }, 401);
      const input = await request.json().catch(() => ({}));
      try {
        const result = await invokeJbhProvider(env, input as Record<string, unknown>);
        return json({ service: 'jussbeautifulhair-site', result });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Provider invocation failed' }, 503);
      }
    }

    return storefrontWorker.fetch(request, env);
  },
};
