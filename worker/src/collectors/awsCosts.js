// worker/src/collectors/awsCosts.js
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { q } from '../db.js';

// Cost Explorer runs in us-east-1 regardless of your resources' regions
const ce = new CostExplorerClient({ region: 'us-east-1' });

function ymd(d) { return d.toISOString().slice(0, 10); }

export async function runAwsCosts() {
  // which tenant to write to (demo for now)
  const tenant = await q("SELECT id FROM tenant WHERE slug='demo' LIMIT 1");
  const tenant_id = tenant.rows[0]?.id;
  if (!tenant_id) return { ok: false, error: 'no_tenant' };

  const windowDays = Number(process.env.COST_WINDOW_DAYS || 30);
  const end = new Date(); // CE End is EXCLUSIVE; using today's date includes up to yesterday
  const start = new Date(end);
  start.setDate(end.getDate() - windowDays);

  let nextToken = undefined;
  let rows = 0;

  // simple retry/backoff for throttling
  const sendWithRetry = async (cmd, attempt = 0) => {
    try {
      return await ce.send(cmd);
    } catch (e) {
      if (e.name === 'ThrottlingException' && attempt < 5) {
        const wait = 400 * Math.pow(2, attempt); // 400ms, 800ms, ...
        await new Promise(r => setTimeout(r, wait));
        return sendWithRetry(cmd, attempt + 1);
      }
      throw e;
    }
  };

  try {
    do {
      const cmd = new GetCostAndUsageCommand({
        TimePeriod: { Start: ymd(start), End: ymd(end) }, // End exclusive
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        NextPageToken: nextToken
      });

      const resp = await sendWithRetry(cmd);
      for (const day of resp.ResultsByTime || []) {
        const d = day.TimePeriod?.Start;
        for (const g of day.Groups || []) {
          const service = g.Keys?.[0] || 'Unknown';
          const amt = parseFloat(g.Metrics?.UnblendedCost?.Amount || '0');
          await q(
            `INSERT INTO cost_daily
              (tenant_id, provider, usage_date, service, resource_id, unblended_cost, currency)
             VALUES ($1,'aws',$2::date,$3,NULL,$4,'USD')
             ON CONFLICT (tenant_id, provider, usage_date, service, resource_id)
             DO UPDATE SET unblended_cost = EXCLUDED.unblended_cost, currency = EXCLUDED.currency`,
            [tenant_id, d, service, amt]
          );
          rows++;
        }
      }
      nextToken = resp.NextPageToken;
    } while (nextToken);

    return { ok: true, upserted: rows, windowDays };
  } catch (e) {
    // Helpful messages for common cases
    if (e.name === 'AccessDeniedException' || /Cost Explorer|not enabled/i.test(e.message || '')) {
      console.error('[costs] Access/CeNotEnabled:', e.message);
      return { ok: false, error: 'ce_not_enabled_or_denied' };
    }
    console.error('[costs] error:', e);
    return { ok: false, error: e.name || 'unknown', message: e.message };
  }
}

