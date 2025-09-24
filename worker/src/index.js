import dotenv from 'dotenv';
import { CronJob } from 'cron';
import { runAwsInventory } from './collectors/awsInventory.js';
import { runAwsCosts } from './collectors/awsCosts.js';
import { runPolicies } from './engine/runPolicies.js';


dotenv.config();


const CRON_INVENTORY = process.env.CRON_INVENTORY || '*/15 * * * *';
const CRON_COSTS = process.env.CRON_COSTS || '0 2 * * *';


console.log('[worker] starting with schedules:', { CRON_INVENTORY, CRON_COSTS });


new CronJob(CRON_INVENTORY, async () => {
console.log('[worker] inventory tick');
try { await runAwsInventory(); await runPolicies(); console.log('[worker] inventory done'); }
catch(e){ console.error('[worker] inventory error', e); }
}, null, true, 'UTC');


new CronJob(CRON_COSTS, async () => {
console.log('[worker] costs tick');
try { await runAwsCosts(); await runPolicies(); console.log('[worker] costs done'); }
catch(e){ console.error('[worker] costs error', e); }
}, null, true, 'UTC');


// keep process alive
setInterval(()=>{}, 1<<30);
