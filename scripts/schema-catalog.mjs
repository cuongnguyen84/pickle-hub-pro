#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export function validate(s) {
 if (s?.format!==1 || s.scope!=='public-catalog-v1' || !Array.isArray(s.objects) || !s.objects.length) throw Error('Invalid or empty catalog snapshot');
 const seen=new Set();
 for(const o of s.objects) {const k=o.kind+':'+o.key; if(!o.kind||!o.key||!o.value||seen.has(k)) throw Error('Invalid/duplicate object');seen.add(k);}
 return s;
}
export function compare(expected,actual) {
 validate(expected);validate(actual);
 if(expected.scope!==actual.scope) throw Error('Snapshot scopes differ');
 if(expected.source?.kind!=='migration-replay'||!expected.source?.sha) throw Error('Expected must be a SHA-pinned migration replay');
 const a=new Map(expected.objects.map(o=>[o.kind+':'+o.key,o]));const b=new Map(actual.objects.map(o=>[o.kind+':'+o.key,o]));const diffs=[];
 const stable=v=>JSON.stringify(v,Object.keys(v).sort());
 for(const key of [...new Set([...a.keys(),...b.keys()])].sort()) {
  const e=a.get(key),v=b.get(key);const status=!e?'production-only':!v?'replay-only':stable(e.value)!==stable(v.value)?'changed':null;
  if(status)diffs.push({kind:(e??v).kind,key:(e??v).key,status,expected:e?.value,actual:v?.value});
 }
 return {format:1,scope:expected.scope,expected:expected.source,actual:actual.source,postgresVersions:[expected.postgres_version,actual.postgres_version],diffs,parity:diffs.length===0};
}
async function main() {
 const [mode,...args]=process.argv.slice(2);
 if(mode==='compare') {const result=compare(...args.slice(0,2).map(p=>JSON.parse(readFileSync(p,'utf8'))));writeFileSync(args[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({differences:result.diffs.length,scope:result.scope,parity:result.parity}));if(!result.parity)process.exitCode=1;return;}
 const sql=readFileSync(new URL('./sql/schema-catalog-snapshot.sql',import.meta.url),'utf8');let snapshot;
 if(mode==='replay') {
  if(!/^[0-9a-f]{40}$/.test(process.env.SCHEMA_SOURCE_SHA??''))throw Error('SCHEMA_SOURCE_SHA required');
  // libpq environment supplies credentials; no URL/password in argv or output.
  const r=await promisify(execFile)('psql',['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],{env:process.env,maxBuffer:20*1024*1024});snapshot=JSON.parse(r.stdout);snapshot.source={kind:'migration-replay',sha:process.env.SCHEMA_SOURCE_SHA};
 } else if(mode==='production') {
  const token=process.env.SUPABASE_ACCESS_TOKEN,ref=process.env.SUPABASE_PROJECT_REF;
  if(!token||!/^[a-z0-9]{20}$/.test(ref??''))throw Error('Management credential/project required');
  // curl config arrives on stdin: PAT never appears in process arguments.
  const config = ['silent','show-error','fail','max-time = 30',
   `url = ${JSON.stringify(`https://api.supabase.com/v1/projects/${ref}/database/query/read-only`)}`,
   `header = ${JSON.stringify(`Authorization: Bearer ${token}`)}`,
   'header = "Content-Type: application/json"',
   `data = ${JSON.stringify(JSON.stringify({query:sql}))}`].join('\n');
  const payload = await new Promise((resolve,reject)=>{
   const child=spawn('curl',['--config','-'],{stdio:['pipe','pipe','pipe']});let data='';
   child.stdout.on('data',c=>{data+=c;if(data.length>20*1024*1024)child.kill();});
   child.stderr.resume();child.on('error',reject);child.on('close',code=>code===0?resolve(data):reject(Error('Read-only request failed')));child.stdin.end(config);
  });
  snapshot=JSON.parse(payload)?.[0]?.snapshot;snapshot.source={kind:'production-catalog',project:ref};
 } else throw Error('Use replay OUTPUT | production OUTPUT | compare EXPECTED ACTUAL OUTPUT');
 validate(snapshot);snapshot.observedAt=new Date().toISOString();writeFileSync(args[0],JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({scope:snapshot.scope,objects:snapshot.objects.length,source:snapshot.source}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(['Invalid or empty catalog snapshot','Invalid/duplicate object','Read-only request failed'].includes(error.message) ? error.message : 'Catalog operation failed; details suppressed to protect credentials.');process.exitCode=2;});
