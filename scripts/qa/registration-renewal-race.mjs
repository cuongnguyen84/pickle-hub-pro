// Registration renewal proof race; disposable local DB only. Requires migration.
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

const run = promisify(execFile);
const DEFAULT_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB = process.env.DB_URL ?? DEFAULT_DB;
const ROUNDS = 15;
const GATE = 430322; // advisory lock key for the start barrier

// Destructive-target guard (Codex P1, both rounds): this script DELETEs rows
// from the budget table. A hostname allowlist is not enough — localhost can be
// an SSH tunnel to production — so ANY override of the known disposable
// default is rejected; this harness never supports remote targets.
if (DB !== DEFAULT_DB) {
  console.error(
    `DB_URL overrides the default disposable target (supabase db start). ` +
      `This harness deletes budget rows — use only the fixed disposable target.`,
  );
  process.exit(2);
}

const psql = async (sql) =>
  (
    await run("psql", [DB, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], { timeout: 10000 })
  ).stdout.trim();

/** Run two SQL statements in two sessions released simultaneously by the
 *  gate lock. Returns their results once both complete. */
async function racePair(sqlA, sqlB) {
  const holder = spawn("psql", [DB, "-X", "-A", "-t"], { stdio: ["pipe", "pipe", "pipe"] });
  // Drain output and suppress pipe errors during forced cleanup.
  holder.stdout.resume(); holder.stderr.resume(); holder.stdin.on("error", () => {});
  const holderDone = new Promise(resolve => { holder.on("close", resolve); holder.on("error", resolve); });
  const children = [holder];
  const racers = [];
  const waitFor = async (predicateSql, want, label) => {
    for (let t=0; t<200; t++) {
      if (await psql(predicateSql) === want) return;
      await sleep(25);
    }
    throw Error(`timeout waiting for ${label}`);
  };
  const racer = sql => {
    const pending = run("psql", [DB, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c",
      `SELECT pg_advisory_lock_shared(${GATE}); SET ROLE service_role; ${sql}`], { timeout: 15000 });
    children.push(pending.child);
    // Observe rejection immediately, even when barrier observation fails first.
    const observed = pending.then(r => ({ value:r.stdout.trim().split("\n").filter(Boolean).at(-1) }), error => ({ error }));
    racers.push(observed);
    return observed;
  };
  try {
    holder.stdin.write(`SELECT pg_advisory_lock(${GATE});\n`);
    await waitFor(`SELECT count(*)::text FROM pg_locks WHERE locktype='advisory' AND objid=${GATE} AND granted`, "1", "coordinator gate");
    const first = racer(sqlA), second = racer(sqlB);
    await waitFor(`SELECT count(*)::text FROM pg_locks WHERE locktype='advisory' AND objid=${GATE} AND NOT granted`, "2", "both racers");
    holder.stdin.end(`SELECT pg_advisory_unlock(${GATE});\n\\q\n`);
    const results = await Promise.all([first,second]);
    if (results.some(r => r.error)) throw Error("race psql session failed");
    return results.map(r => r.value);
  } finally {
    for (const child of children) if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await Promise.allSettled([...racers,holderDone]);
  }
}

const owner='f6250000-0000-4000-8000-000000000001';
const event='f6250000-0000-4000-8000-000000000002';
const registration='f6250000-0000-4000-8000-000000000003';
const phone='+84901234568';
try {
 await psql(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('${owner}','renew-race@thepicklehub.test','{}');
 INSERT INTO public.profiles(id,email,display_name) VALUES('${owner}','renew-race@thepicklehub.test','Fixture') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.social_events(id,slug,title_vi,start_at,end_at,created_by) VALUES('${event}','renew-race-fixture','Fixture',now()+interval '1 day',now()+interval '2 days','${owner}');
 INSERT INTO public.event_registrations(id,event_id,profile_id,display_name,phone) VALUES('${registration}','${event}','${owner}','Fixture','${phone}');
 INSERT INTO public.registration_secrets(registration_id) VALUES('${registration}');`);
 for(let i=0;i<ROUNDS;i++) {
  await psql(`DELETE FROM public.registration_renewal_challenges WHERE registration_id='${registration}';
  UPDATE public.registration_secrets SET expires_at=now()-interval '1 day' WHERE registration_id='${registration}';
  INSERT INTO public.registration_renewal_challenges(registration_id,phone,ip_hash,code_hash,delivered_at)
  VALUES('${registration}','${phone}',repeat('a',64),repeat('b',64),now());`);
  const sql=`SELECT count(*) FROM public.renew_registration_token_by_phone('${phone}','${event}',repeat('b',64))`;
  const result=await racePair(sql,sql);
  if(result.sort().join()!=='0,1') throw Error('proof consumed more or less than once');
  if(await psql(`SELECT count(*) FROM public.registration_secrets WHERE registration_id='${registration}' AND expires_at>now()`) !== '1') throw Error('missing renewed secret');
  await psql(`DELETE FROM public.registration_renewal_challenges WHERE registration_id='${registration}';
  INSERT INTO public.registration_renewal_challenges(registration_id,phone,ip_hash,code_hash)
  SELECT '${registration}','${phone}',repeat('c',64),repeat('d',64) FROM generate_series(1,2);`);
  const budget=`SELECT count(*) FROM public.begin_registration_renewal('${phone}','${event}',repeat('e',64),repeat('f',64))`;
  if((await racePair(budget,budget)).sort().join()!=='0,1') throw Error('phone provider budget final slot overspent');
  await psql(`DELETE FROM public.registration_renewal_challenges WHERE registration_id='${registration}';
  INSERT INTO public.registration_renewal_challenges(registration_id,phone,ip_hash,code_hash)
  SELECT '${registration}','+848'||lpad(i::text,8,'0'),repeat('c',64),repeat('d',64) FROM generate_series(1,49) i;`);
  if((await racePair(budget,budget)).sort().join()!=='0,1') throw Error('global provider budget final slot overspent');


 }
 // A stale joined snapshot must not authorize after a locked phone reassignment.
 await psql(`DELETE FROM public.registration_renewal_challenges WHERE registration_id='${registration}';
 UPDATE public.registration_secrets SET expires_at=now()-interval '1 day' WHERE registration_id='${registration}';
 INSERT INTO public.registration_renewal_challenges(registration_id,phone,ip_hash,code_hash,delivered_at)
 VALUES('${registration}','${phone}',repeat('a',64),repeat('b',64),now());`);
 const holder=spawn('psql',[DB,'-X','-A','-t','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe'],env:{...process.env,PGAPPNAME:'renewal-phone-holder'}});
 holder.stdout.resume();holder.stderr.resume();holder.stdin.on('error',()=>{});
 const done=new Promise(resolve=>{holder.on('close',resolve);holder.on('error',resolve);});
 let pending;
 const waitActivity=async(name,condition)=>{
  for(let i=0;i<200;i++){
   if(await psql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND ${condition}`)==='1')return;
   await sleep(25);
  }
  throw Error('mutable recipient race did not reach lock barrier');
 };
 try {
  holder.stdin.write(`BEGIN; SELECT id FROM public.event_registrations WHERE id='${registration}' FOR UPDATE;` + String.fromCharCode(10));
  await waitActivity('renewal-phone-holder',"state='idle in transaction'");
  pending=run('psql',[DB,'-X','-A','-t','-v','ON_ERROR_STOP=1','-c',`SET ROLE service_role; SELECT count(*) FROM public.renew_registration_token_by_phone('${phone}','${event}',repeat('b',64))`],{timeout:15000,env:{...process.env,PGAPPNAME:'renewal-phone-racer'}}).then(r=>({value:r.stdout.trim().split(String.fromCharCode(10)).at(-1)}),error=>({error}));
  await waitActivity('renewal-phone-racer',"wait_event_type='Lock'");
  holder.stdin.end(`UPDATE public.event_registrations SET phone='+84909999999' WHERE id='${registration}'; COMMIT;` + String.fromCharCode(10));
  const result=await pending;
  if(result.error || result.value!=='0')throw Error('phone reassignment bypassed locked ownership recheck');
 } finally {
  if(holder.exitCode===null)holder.kill('SIGKILL');
  await Promise.allSettled([done,...(pending?[pending]:[])]);
 }
} finally {
 await psql(`DELETE FROM public.social_events WHERE id='${event}'; DELETE FROM public.profiles WHERE id='${owner}'; DELETE FROM auth.users WHERE id='${owner}';`);
}
console.log(`${ROUNDS} synchronized renewal proof races passed; one proof consumption, one current credential, one final phone and global budget slot; mutable recipient race denied.`);
