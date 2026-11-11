import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

test('valid structural checks never become AI approval through the retired manual gate',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'spu-gate-retired-')),event=path.join(root,'event.json'),log=path.join(root,'statuses.jsonl');
 t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.writeFile(event,JSON.stringify({pull_request:{number:1}}));
 const child=spawn(process.execPath,['--import','./tests/helpers/retired-gate-fixture.mjs','scripts/gate.mjs'],{env:{...process.env,GITHUB_REPOSITORY:'example/spu',GITHUB_TOKEN:'synthetic-test-token',GITHUB_EVENT_PATH:event,GITHUB_RUN_ID:'test',SPU_GATE_TEST_LOG:log},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',b=>errors+=b);child.stdout.resume();
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});assert.equal(code,0,errors);
 const states=(await fs.readFile(log,'utf8')).trim().split('\n').map(JSON.parse);
 for(const name of ['task-validation','reference-validation'])assert.ok(states.some(s=>s.context===name&&s.state==='success'));
 const review=states.filter(s=>s.context==='review-gate');assert.ok(review.length>0);assert.ok(review.every(s=>s.state==='pending'));assert.match(review.at(-1).description,/not connected/);
});

test('legacy executable gate defers new plan/workbook intake to the dedicated quality check',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'spu-gate-intake-')),event=path.join(root,'event.json'),log=path.join(root,'statuses.jsonl');
 t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.writeFile(event,JSON.stringify({pull_request:{number:1}}));
 const child=spawn(process.execPath,['--import','./tests/helpers/retired-gate-fixture.mjs','scripts/gate.mjs'],{env:{...process.env,GITHUB_REPOSITORY:'example/spu',GITHUB_TOKEN:'synthetic-test-token',GITHUB_EVENT_PATH:event,GITHUB_RUN_ID:'test',SPU_GATE_TEST_LOG:log,SPU_GATE_INTAKE:'1'},stdio:['ignore','pipe','pipe']});child.stderr.resume();child.stdout.resume();
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});assert.equal(code,0);
 const states=(await fs.readFile(log,'utf8')).trim().split('\n').map(JSON.parse);assert.equal(states.length,2);assert.ok(states.every(s=>s.state==='success'));assert.ok(states.some(s=>s.description.includes('Not applicable')));assert.ok(states.some(s=>s.description.includes('spu/clarity-audit')));assert.ok(!states.some(s=>s.context==='review-gate'||s.context==='spu/clarity-audit'));
});
test('docs and infrastructure PRs are not failed as broken tasks and get no review gate',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'spu-gate-docs-')),event=path.join(root,'event.json'),log=path.join(root,'statuses.jsonl');
 t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.writeFile(event,JSON.stringify({pull_request:{number:1}}));
 const child=spawn(process.execPath,['--import','./tests/helpers/retired-gate-fixture.mjs','scripts/gate.mjs'],{env:{...process.env,GITHUB_REPOSITORY:'example/spu',GITHUB_TOKEN:'synthetic-test-token',GITHUB_EVENT_PATH:event,GITHUB_RUN_ID:'test',SPU_GATE_TEST_LOG:log,SPU_GATE_INTAKE:'docs'},stdio:['ignore','pipe','pipe']});child.stderr.resume();child.stdout.resume();
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});assert.equal(code,0);
 const states=(await fs.readFile(log,'utf8')).trim().split('\n').map(JSON.parse);assert.deepEqual(states.map(s=>[s.context,s.state]),[['task-validation','success'],['reference-validation','success']]);assert.ok(states.every(s=>s.description.startsWith('Not applicable')));
});
