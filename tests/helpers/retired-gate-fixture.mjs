import fs from 'node:fs/promises';
const sha='a'.repeat(40),repo='/repos/example/spu',mode=process.env.SPU_GATE_INTAKE,dir=mode==='1'?'submissions/synthetic-task':mode==='docs'?'docs/guide':'benchmark/tasks/life-sciences/spu-example-0001';
const names=['task.yaml','answer.json','prompt.txt','provenance.json','rationale.md','reference.json','submission.json'];
const pr={number:1,state:'open',head:{sha},changed_files:names.length,labels:[{name:'triage:accepted'}],user:{login:'author'},requested_reviewers:[],draft:false};
const json=value=>new Response(JSON.stringify(value),{status:200});
globalThis.fetch=async(url,options)=>{
 const u=new URL(url),p=u.pathname;
 if(u.origin!=='https://api.github.com')throw new Error('Unexpected network origin');
 if(options.method==='POST'&&p===repo+'/statuses/'+sha){await fs.appendFile(process.env.SPU_GATE_TEST_LOG,options.body+'\n');return json({})}
 if(p===repo+'/pulls/1')return json(pr);
 if(p===repo+'/pulls/1/files')return json(names.map(name=>({filename:dir+'/'+name})));
 if(p===repo+'/git/trees/'+sha)return json({truncated:false,tree:await Promise.all(names.map(async name=>({path:dir+'/'+name,type:'blob',mode:'100644',size:(await fs.stat('examples/synthetic/spu-example-0001/'+name)).size})))});
 if(p.startsWith(repo+'/contents/'+dir+'/')){const name=p.split('/').at(-1);if(!names.includes(name))throw new Error('Unexpected content');const raw=await fs.readFile('examples/synthetic/spu-example-0001/'+name);return json({type:'file',encoding:'base64',size:raw.length,content:raw.toString('base64')})}
 // Even unanimous historical approvals must not satisfy the replacement AI gate.
 if(p===repo+'/pulls/1/reviews')return json(['domain','technical','final'].map(login=>({user:{login},state:'APPROVED',commit_id:sha,submitted_at:'2026-10-21T00:00:00Z'})));
 throw new Error('Unexpected API request: '+p);
};
