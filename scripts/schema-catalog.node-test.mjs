import { test } from 'node:test';import assert from 'node:assert/strict';import { compare,validate } from './schema-catalog.mjs';
const fixture=()=>({format:1,scope:'public-catalog-v1',source:{kind:'migration-replay',sha:'a'.repeat(40)},objects:[{kind:'policy',key:'x',value:{a:1,b:true}}]});
test('equal property order does not manufacture drift',()=>{const a=fixture(),b=fixture();b.objects[0].value={b:true,a:1};assert.equal(compare(a,b).parity,true)});
test('changed policy is actionable',()=>{const a=fixture(),b=fixture();b.objects[0].value.a=2;assert.equal(compare(a,b).diffs[0].status,'changed')});
test('both missing directions retained',()=>{const a=fixture(),b=fixture();b.objects[0].key='other';assert.deepEqual(compare(a,b).diffs.map(x=>x.status).sort(),['production-only','replay-only'])});
test('empty duplicate and unpinned sources fail closed',()=>{const a=fixture();assert.throws(()=>validate({...a,objects:[]}));assert.throws(()=>validate({...a,objects:[...a.objects,...a.objects]}));assert.throws(()=>compare({...a,source:{}},a))});
