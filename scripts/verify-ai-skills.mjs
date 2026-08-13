import {access, readFile, readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'AGENTS.md',
  'AGENTS_FOUNDER_INTELLIGENCE.md',
  '.agents/skills/sales/SKILL.md',
  '.agents/skills/devil/SKILL.md',
  'artifacts/redteam/SALES_DEVIL_ATTACK.md',
  'artifacts/lindymode/SALES_DURABILITY.md',
  'artifacts/l99/SALES_AUTHORITY_MODEL.md',
  'artifacts/ooda/SALES_EXECUTION_LOOP.md',
  'artifacts/ultrathink/SALES_DEVIL_SYNTHESIS.md',
  'artifacts/billgates/SALES_PLATFORM_LEVERAGE.md',
];
const failures = [];
for (const file of requiredFiles) {
  try { await access(file, constants.R_OK); } catch { failures.push(`missing required file: ${file}`); }
}
let operatorFiles = [];
try {
  const entries = await readdir('.agents/skills', {withFileTypes: true});
  operatorFiles = entries.filter((entry) => entry.isDirectory() && entry.name.endsWith('operator')).map((entry) => path.join('.agents/skills', entry.name, 'SKILL.md'));
} catch { failures.push('cannot read .agents/skills'); }
if (operatorFiles.length !== 1) failures.push(`expected exactly one repository operator skill, found ${operatorFiles.length}`);
const texts = new Map();
for (const file of [...requiredFiles, ...operatorFiles]) {
  try { texts.set(file, await readFile(file, 'utf8')); } catch {}
}
const agents = texts.get('AGENTS.md') ?? '';
const founder = texts.get('AGENTS_FOUNDER_INTELLIGENCE.md') ?? '';
const operator = operatorFiles.length === 1 ? texts.get(operatorFiles[0]) ?? '' : '';
const sales = texts.get('.agents/skills/sales/SKILL.md') ?? '';
const devil = texts.get('.agents/skills/devil/SKILL.md') ?? '';
const all = [...texts.values()].join('\n').toLowerCase();
for (const ref of ['.agents/skills/sales/SKILL.md', '.agents/skills/devil/SKILL.md']) {
  if (!agents.includes(ref)) failures.push(`AGENTS.md does not activate ${ref}`);
}
for (const token of ['/sales', '/devil', '5w1h', 'redteam', 'lindymode', 'l99', 'ooda', 'ultrathink', 'bill gates', 'proof', 'rollback', 'approval']) {
  if (!all.includes(token)) failures.push(`missing contract token: ${token}`);
}
const founderLower = founder.toLowerCase();
for (const command of ['/goalfix', '/ultrathink', '/truthmode', '/confess', '/redteam', '/lindymode', '/ooda', '/visualize']) {
  if (!founderLower.includes(command)) failures.push(`Founder Intelligence missing portable command: ${command}`);
}
for (const phrase of [
  'reasoning/planning modes only',
  'never grant tool',
  'explicit founder gates',
  'local rule is stricter',
  'visual output is not checkout',
]) {
  if (!founderLower.includes(phrase)) failures.push(`Founder Intelligence missing authority boundary: ${phrase}`);
}
for (const [label, source, phrases] of [
  ['sales', sales, ['qualif', 'disqualif', 'proof', 'not authorization']],
  ['devil', devil, ['premise', 'plan', 'kill criteria', 'does not authorize']],
]) {
  const lower = source.toLowerCase();
  for (const phrase of phrases) if (!lower.includes(phrase)) failures.push(`${label} skill missing: ${phrase}`);
}
for (const [label, source] of [['AGENTS.md', agents], ['repository operator', operator]]) {
  const lower = source.toLowerCase();
  for (const phrase of ['exact-fix doctrine', 'exact evidence-backed fix', 'full correctness boundary']) {
    if (!lower.includes(phrase)) failures.push(`${label} missing exact-fix contract: ${phrase}`);
  }
}
if (!agents.toLowerCase().includes('separate')) failures.push('AGENTS.md must preserve explicit project or data separation');
for (const forbidden of [
  'guaranteed conversion',
  'bypass founder approval',
  'automatic outreach without approval',
  'the smallest safe implementation',
  'choose the smallest reversible action',
  'make the smallest coherent, reversible change',
]) {
  if (all.includes(forbidden)) failures.push(`forbidden unsafe or partial-fix contract text: ${forbidden}`);
}
if (failures.length) {
  console.error('AI skill contract failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('AI skill contract passed.');