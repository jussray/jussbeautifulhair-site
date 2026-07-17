import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expectedServerNames = [
  'cloudflare-builds',
  'cloudflare-docs',
  'cloudflare-observability',
  'context7',
  'github',
  'playwright',
];

const expectedRemoteUrls = {
  github: 'https://api.githubcopilot.com/mcp/',
  context7: 'https://mcp.context7.com/mcp',
  'cloudflare-docs': 'https://docs.mcp.cloudflare.com/mcp',
  'cloudflare-builds': 'https://builds.mcp.cloudflare.com/mcp',
  'cloudflare-observability': 'https://observability.mcp.cloudflare.com/mcp',
};

const expectedGithubToolsets =
  'repos,issues,pull_requests,actions,code_security,secret_protection';
const pinnedPlaywrightPackage = '@playwright/mcp@0.0.78';

function fail(message) {
  throw new Error(`[verify:mcp] ${message}`);
}

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    fail(`${relativePath} is missing or invalid JSON: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sortedKeys(value) {
  return Object.keys(value ?? {}).sort();
}

function validateServerSet(relativePath, servers) {
  assert(
    JSON.stringify(sortedKeys(servers)) === JSON.stringify(expectedServerNames),
    `${relativePath} must contain exactly: ${expectedServerNames.join(', ')}`,
  );
}

function validateRemoteServers(relativePath, servers) {
  for (const [name, url] of Object.entries(expectedRemoteUrls)) {
    assert(servers[name]?.type === 'http', `${relativePath}:${name} must use HTTP`);
    assert(servers[name]?.url === url, `${relativePath}:${name} URL drifted`);
  }

  const githubHeaders = servers.github?.headers ?? {};
  assert(
    githubHeaders['X-MCP-Toolsets'] === expectedGithubToolsets,
    `${relativePath}:github toolsets drifted`,
  );
  assert(
    githubHeaders['X-MCP-Lockdown'] === 'true',
    `${relativePath}:github lockdown mode must remain enabled while the repo is public`,
  );
  assert(
    !githubHeaders.Authorization,
    `${relativePath}:github Authorization headers must not be committed`,
  );
  assert(
    githubHeaders['X-MCP-Insiders'] !== 'true',
    `${relativePath}:github insiders mode is a private opt-in, not a repository default`,
  );
}

function validatePlaywright(relativePath, server, requireStdioType = false) {
  if (requireStdioType) {
    assert(server?.type === 'stdio', `${relativePath}:playwright must use stdio`);
  }
  assert(server?.command === 'npx', `${relativePath}:playwright command must be npx`);
  assert(Array.isArray(server?.args), `${relativePath}:playwright args are missing`);
  assert(
    server.args.includes(pinnedPlaywrightPackage),
    `${relativePath}:playwright must stay pinned to ${pinnedPlaywrightPackage}`,
  );
  assert(!server.args.some((arg) => String(arg).includes('@latest')), `${relativePath}:MCP packages cannot use @latest`);
  assert(server.args.includes('--isolated'), `${relativePath}:playwright must use an isolated profile`);
  const browserIndex = server.args.indexOf('--browser');
  assert(
    browserIndex >= 0 && server.args[browserIndex + 1] === 'chromium',
    `${relativePath}:playwright browser must be chromium`,
  );
}

function assertNoCommittedSecrets(relativePath, parsed) {
  const serialized = JSON.stringify(parsed);
  const secretPatterns = [
    /github_pat_/i,
    /ghp_[A-Za-z0-9]{20,}/,
    /sk_(?:live|test)_[A-Za-z0-9]{16,}/i,
    /whsec_[A-Za-z0-9]{12,}/i,
    /Bearer\s+[A-Za-z0-9._-]{12,}/i,
    /CLOUDFLARE_API_TOKEN/,
    /DATABASE_URL/,
  ];

  for (const pattern of secretPatterns) {
    assert(!pattern.test(serialized), `${relativePath} appears to contain a committed credential`);
  }
}

const projectConfig = readJson('.mcp.json');
const exampleConfig = readJson('.mcp.example.json');
const vscodeConfig = readJson('.vscode/mcp.json');

const projectServers = projectConfig.mcpServers;
const exampleServers = exampleConfig.mcpServers;
const vscodeServers = vscodeConfig.servers;

validateServerSet('.mcp.json', projectServers);
validateServerSet('.mcp.example.json', exampleServers);
validateServerSet('.vscode/mcp.json', vscodeServers);

validateRemoteServers('.mcp.json', projectServers);
validateRemoteServers('.mcp.example.json', exampleServers);
validateRemoteServers('.vscode/mcp.json', vscodeServers);

validatePlaywright('.mcp.json', projectServers.playwright);
validatePlaywright('.mcp.example.json', exampleServers.playwright);
validatePlaywright('.vscode/mcp.json', vscodeServers.playwright, true);

for (const [relativePath, parsed] of [
  ['.mcp.json', projectConfig],
  ['.mcp.example.json', exampleConfig],
  ['.vscode/mcp.json', vscodeConfig],
]) {
  assertNoCommittedSecrets(relativePath, parsed);
  const servers = parsed.mcpServers ?? parsed.servers;
  assert(!servers.supabase, `${relativePath}:the public storefront must not receive direct Supabase access`);
  assert(!servers.dbhub, `${relativePath}:DBHub is not part of the default storefront trust boundary`);
  assert(!servers['netdata-cloud'], `${relativePath}:Netdata is not justified without owned persistent infrastructure`);
}

console.log('[verify:mcp] Storefront MCP configuration is scoped, pinned, and credential-free.');
