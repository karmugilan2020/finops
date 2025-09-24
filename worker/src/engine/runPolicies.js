import fs from 'fs';
import YAML from 'yaml';
import { q } from '../db.js';
import { safeEval } from './utils.js';


export async function runPolicies(){
const file = process.env.POLICY_FILE || '/app/policies/aws.yml';
const spec = YAML.parse(fs.readFileSync(file, 'utf8')) || [];
const { rows: assets } = await q('SELECT tenant_id, provider, service, resource_id, state, metadata FROM asset');
let inserted = 0;
for (const a of assets){
for (const p of spec){
if (p.match?.service !== a.service) continue;
const env = { metadata: a.metadata || {}, state: a.state || '' };
if (!safeEval(p.match?.where || 'false', env)) continue;
const saving = Number(safeEval(String(p.saving?.monthly_usd || '0'), env) || 0);
await q(`INSERT INTO recommendation (tenant_id, policy_key, provider, service, resource_id, details, est_monthly_saving)
VALUES ($1,$2,$3,$4,$5,$6,$7)`,
[a.tenant_id, p.key, a.provider, a.service, a.resource_id, JSON.stringify({ reason: p.name, metadata: a.metadata }), saving]);
inserted++;
}
}
return { ok: true, inserted };
}
