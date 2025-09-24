import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import YAML from 'yaml';
import { query } from './db.js';

dotenv.config();
const app = express();
app.use(express.json({ limit: '2mb' }));
const origins = (process.env.CORS_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : '*' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/summary', async (_req, res) => {
  try {
    const a = await query('SELECT COUNT(*)::int c FROM asset');
    const s = await query('SELECT COUNT(DISTINCT service)::int c FROM asset');
    const c = await query(`SELECT COALESCE(SUM(unblended_cost),0)::float s
                           FROM cost_daily WHERE usage_date >= CURRENT_DATE - INTERVAL '30 days'`);
    const r = await query('SELECT status, COUNT(*)::int c FROM recommendation GROUP BY status');
    res.json({ assets: a.rows[0]?.c||0, services: s.rows[0]?.c||0, cost_30d: c.rows[0]?.s||0,
      reco_breakdown: Object.fromEntries(r.rows.map(x=>[x.status, x.c])) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'summary_failed' }); }
});

app.get('/recommendations', async (req, res) => {
  const status = (req.query.status || 'open').toString();
  try {
    const r = await query(`SELECT policy_key, provider, service, resource_id, detected_at, details, est_monthly_saving
                           FROM recommendation WHERE status=$1 ORDER BY detected_at DESC LIMIT 500`, [status]);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'reco_failed' }); }
});

// optional: manual policy run via API
app.post('/policies/run', async (_req, res) => {
  try {
    const policyFile = process.env.POLICY_FILE || '/app/policies/aws.yml';
    const spec = YAML.parse(fs.readFileSync(policyFile, 'utf8')) || [];
    const { rows: assets } = await query('SELECT tenant_id, provider, service, resource_id, state, metadata FROM asset');
    let inserted = 0;
    for (const a of assets) {
      for (const p of spec) {
        if (p.match?.service !== a.service) continue;
        const metadata = a.metadata || {}; const state = a.state || '';
        if (!safeEval(p.match?.where || 'false', { metadata, state })) continue;
        const saving = Number(safeEval(String(p.saving?.monthly_usd || '0'), { metadata, state }) || 0);
        await query(`INSERT INTO recommendation (tenant_id, policy_key, provider, service, resource_id, details, est_monthly_saving)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [a.tenant_id, p.key, a.provider, a.service, a.resource_id,
           JSON.stringify({ reason: p.name, metadata }), saving]);
        inserted++;
      }
    }
    res.json({ ok: true, inserted });
  } catch (e) { console.error(e); res.status(500).json({ error: 'policy_run_failed' }); }
});

function safeEval(expr, env) {
  try { return Function('metadata','state',`return (${expr})`)(env.metadata, env.state); }
  catch { return false; }
}

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on :${port}`));

