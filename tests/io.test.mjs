import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {GitHub,checkStates} from '../scripts/github.mjs';
import {validateTask,readSafe} from '../scripts/validate.mjs';
test('REST pagination follows all pages',async()=>{let calls=0;const api=new GitHub('test',async()=>{calls++;return new Response(JSON.stringify([{number:calls}]),{headers:calls===1?{link:'<https://api.github.com/repos/o/r/pulls?page=2>; rel="next"'}:{}})});assert.equal((await api.pages('/repos/o/r/pulls')).length,2);assert.equal(calls,2)});
test('pagination will not forward credentials to foreign origin',async()=>{const api=new GitHub('test',async()=>new Response('[]',{headers:{link:'<https://evil.example/steal>; rel="next"'}}));await assert.rejects(api.pages('/repos/o/r/pulls'),/来源/)});
test('API error payloads are never interpreted as empty data',async()=>{const api=new GitHub('test',async()=>new Response('{"errors":[{}],"data":null}'));await assert.rejects(api.get('/repos/o/r'),/不完整/)});
test('check results only accept designated publisher',()=>{const r={context:'validate',state:'success',creator:{login:'author'}};assert.equal(checkStates([r],'sha',{maintainers:[]}).length,0)});
test('file reader rejects symlinks and parent escape',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'spu-file-'));try{await fs.symlink('/etc/passwd',path.join(dir,'prompt.txt'));await assert.rejects(readSafe(dir,'prompt.txt'));await assert.rejects(readSafe(dir,'../passwd'))}finally{await fs.rm(dir,{recursive:true,force:true})}});
test('synthetic example passes real schema and scorer checks',async()=>{const result=await validateTask('examples/synthetic/spu-example-0001');assert.equal(result.reference.score,1)});

test('mock GitHub failures: transient 503 recovers, cycles and malformed page shapes fail closed',async()=>{
 let calls=0;const api=new GitHub('mock-token',async()=>++calls===1?new Response('{}',{status:503}):Response.json([{number:1}]));assert.equal((await api.pages('/repos/mock/tasks/pulls')).length,1);assert.equal(calls,2);
 const loop=new GitHub('mock-token',async()=>new Response('[]',{headers:{link:'<https://api.github.com/repos/mock/tasks/pulls?per_page=100>; rel="next"'}}));await assert.rejects(loop.pages('/repos/mock/tasks/pulls'),/分页/);
 const bad=new GitHub('mock-token',async()=>Response.json({message:'not a page'}));await assert.rejects(bad.pages('/repos/mock/tasks/pulls'),/格式/);
});
