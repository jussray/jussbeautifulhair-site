const MAX_RESPONSE_BYTES = 64 * 1024;
const TIMEOUT_MS = 60_000;

type ProviderName = 'openai' | 'anthropic' | 'muse';

type ProviderEnv = {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  MODEL_API_KEY?: string;
  JBH_OPENAI_MODEL?: string;
  JBH_ANTHROPIC_MODEL?: string;
  JBH_MUSE_MODEL?: string;
};

const PROVIDERS = {
  openai: { key: 'OPENAI_API_KEY', model: 'JBH_OPENAI_MODEL', defaultModel: 'gpt-5.6-sol', url: 'https://api.openai.com/v1/responses' },
  anthropic: { key: 'ANTHROPIC_API_KEY', model: 'JBH_ANTHROPIC_MODEL', defaultModel: 'claude-sonnet-5', url: 'https://api.anthropic.com/v1/messages' },
  muse: { key: 'MODEL_API_KEY', model: 'JBH_MUSE_MODEL', defaultModel: 'muse-spark-1.3', url: 'https://api.meta.ai/v1/responses' },
} as const;

function configFor(env: ProviderEnv, provider: ProviderName) {
  const config = PROVIDERS[provider];
  const key = String(env[config.key] || '').trim();
  const model = String(env[config.model] || '').trim() || config.defaultModel;
  return { ...config, key, modelName: model };
}

export function jbhProviderStates(env: ProviderEnv) {
  return Object.fromEntries((Object.keys(PROVIDERS) as ProviderName[]).map((provider) => {
    const config = configFor(env, provider);
    return [provider, { state: config.key ? 'INTEGRATED' : 'ABSENT', model: config.modelName }];
  }));
}

function validId(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && id.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(id) ? id : null;
}

function textFromBody(provider: ProviderName, body: Record<string, unknown>): string {
  if (provider === 'anthropic') {
    const content = Array.isArray(body.content) ? body.content : [];
    return content.flatMap((entry) => {
      const block = entry && typeof entry === 'object' ? entry as Record<string, unknown> : null;
      return block?.type === 'text' && typeof block.text === 'string' && block.text.trim() ? [block.text.trim()] : [];
    }).join('\n');
  }
  if (typeof body.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  const output = Array.isArray(body.output) ? body.output : [];
  const parts: string[] = [];
  for (const item of output) {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : null;
    const content = Array.isArray(record?.content) ? record.content : [];
    for (const entry of content) {
      const block = entry && typeof entry === 'object' ? entry as Record<string, unknown> : null;
      if (typeof block?.text === 'string' && block.text.trim()) parts.push(block.text.trim());
    }
  }
  return parts.join('\n');
}

export async function invokeJbhProvider(
  env: ProviderEnv,
  input: { provider?: unknown; prompt?: unknown; sensitivity?: unknown },
  fetchImpl: typeof fetch = fetch,
) {
  const provider = String(input?.provider || '').trim().toLowerCase() as ProviderName;
  if (!(provider in PROVIDERS)) throw new Error('unsupported provider');
  const prompt = String(input?.prompt || '').trim();
  const sensitivity = String(input?.sensitivity || 'standard').trim().toLowerCase();
  if (!prompt || prompt.length > 12_000) throw new Error('prompt must be 1..12000 characters');
  if (sensitivity === 'restricted') throw new Error('restricted context is not authorized for external providers');
  const config = configFor(env, provider);
  if (!config.key) throw new Error(`${provider} provider is not configured`);

  const headers: Record<string, string> = provider === 'anthropic'
    ? { 'x-api-key': config.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
    : { authorization: `Bearer ${config.key}`, 'content-type': 'application/json' };
  const body = provider === 'anthropic'
    ? { model: config.modelName, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }
    : { model: config.modelName, input: prompt, store: false, max_output_tokens: 1200 };

  let response: Response;
  try {
    response = await fetchImpl(config.url, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new Error(`${provider} provider request failed`);
  }
  if (!response.ok) throw new Error(`${provider} provider failed with HTTP ${response.status}`);
  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) throw new Error(`${provider} response too large`);
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error(`${provider} returned invalid JSON`); }
  const responseId = validId(parsed.id);
  if (!responseId) throw new Error(`${provider} provider returned invalid response identity`);
  const text = textFromBody(provider, parsed);
  if (!text) throw new Error(`${provider} provider returned no usable text`);
  return {
    state: 'INTEGRATED' as const,
    provider,
    model: config.modelName,
    responseId,
    evidenceRef: `provider:${provider === 'muse' ? 'meta' : provider}:${responseId}`,
    authority: 'none' as const,
    text,
  };
}
