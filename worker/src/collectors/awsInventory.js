// worker/src/collectors/awsInventory.js
import {
  EC2Client,
  DescribeRegionsCommand,
  paginateDescribeInstances,
  paginateDescribeVolumes
} from '@aws-sdk/client-ec2';
import { q } from '../db.js';

export async function runAwsInventory(){
  const seedRegion = process.env.AWS_REGION || 'us-east-1';
  // 1) list regions first
  const regionsClient = new EC2Client({ region: seedRegion });
  const { Regions = [] } = await regionsClient.send(new DescribeRegionsCommand({ AllRegions: false }));

  const tenant = await q("SELECT id FROM tenant WHERE slug='demo' LIMIT 1");
  const tenant_id = tenant.rows[0]?.id;
  if (!tenant_id) return;

  for (const r of Regions) {
    const regionName = r.RegionName;
    const ec2 = new EC2Client({ region: regionName });

    // EC2 instances
    const p1 = paginateDescribeInstances({ client: ec2 }, {});
    for await (const page of p1) {
      for (const reservation of page.Reservations || []) {
        for (const inst of reservation.Instances || []) {
          const tags = (inst.Tags || []).reduce((m, t) => { m[t.Key] = t.Value; return m; }, {});
          await q(
            `INSERT INTO asset (tenant_id, provider, service, resource_id, region, state, metadata, first_seen, last_seen)
             VALUES ($1,'aws','ec2',$2,$3,$4,$5::jsonb, now(), now())
             ON CONFLICT (tenant_id, provider, resource_id) DO UPDATE
             SET region=EXCLUDED.region, state=EXCLUDED.state, metadata=EXCLUDED.metadata, last_seen=now()`,
            [tenant_id, inst.InstanceId, regionName, inst.State?.Name || '', JSON.stringify({ instance_type: inst.InstanceType, tags })]
          );
        }
      }
    }

    // EBS volumes
    const p2 = paginateDescribeVolumes({ client: ec2 }, {});
    for await (const page of p2) {
      for (const vol of page.Volumes || []) {
        const attachments = (vol.Attachments || []).map(a => ({ InstanceId: a.InstanceId, State: a.State }));
        const tags = (vol.Tags || []).reduce((m, t) => { m[t.Key] = t.Value; return m; }, {});
        await q(
          `INSERT INTO asset (tenant_id, provider, service, resource_id, region, state, metadata, first_seen, last_seen)
           VALUES ($1,'aws','ebs',$2,$3,$4,$5::jsonb, now(), now())
           ON CONFLICT (tenant_id, provider, resource_id) DO UPDATE
           SET region=EXCLUDED.region, state=EXCLUDED.state, metadata=EXCLUDED.metadata, last_seen=now()`,
          [tenant_id, vol.VolumeId, regionName, attachments.length ? 'in-use' : 'available', JSON.stringify({ size_gb: vol.Size, attachments, tags })]
        );
      }
    }
  }
  return { ok: true };
}

