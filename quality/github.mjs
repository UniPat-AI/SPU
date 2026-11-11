import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {ENGINE_VERSION,reviewSubmission,renderReport,sha256} from './review.mjs';
const safeTask=/^submissions\/([a-z0-9][a-z0-9_-]{2,79})(?:\/|$)/;
const MAX_FILES=1000,MAX_TASKS=3,MAX_BLOB=8*1024*1024;
export function intakeScope(files){
 if(!Array.isArray(files)||files.length>MAX_FILES)throw new Error('PR file count exceeds inspection limit');
 const names=files.flatMap(f=>[f.filename,...(f.previous_filename?[f.previous_filename]:[])]);
 if(names.some(f=>typeof f!=='string'||f.length>500||f.startsWith('/')||f.includes('\\')||f.split('/').some(x=>x==='..'||x==='.')))throw new Error('Invalid changed-file path');
 if(names.some(f=>f.startsWith('submissions/')&&!safeTask.test(f)))throw new Error('Submission paths must use a lowercase task identifier directory');
 const tasks=[...new Set(names.map(f=>f.match(safeTask)?.[1]).filter(Boolean))].sort();
 if(tasks.length>MAX_TASKS)throw new Error('At most three task submissions can be inspected per PR');
 const mixed=tasks.length&&names.some(f=>!safeTask.test(f)&&!f.startsWith('docs/'));
 return {tasks,mixed:Boolean(mixed)};
}
export async function runQualityPR({api,repository,number,outDirectory,reviewer=null,publish=false,runUrl=null}){
 if(!/^[\w.-]+\/[\w.-]+$/.test(repository)||!Number.isSafeInteger(number)||number<1)throw new Error('Invalid repository or PR number');
 if(publish&&(!runUrl||!new RegExp('^https://github\\.com/'+repository.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/actions/runs/[0-9]+$').test(runUrl)))throw new Error('Status URL must refer to this repository Actions run');
 const root='/repos/'+repository,pr=await api.get(root+'/pulls/'+number),head=pr.head?.sha;
 if(!/^[a-f0-9]{40}$/.test(head||''))throw new Error('Missing immutable PR head SHA');
 const source={mode:'github',repository,pr:number,head_sha:head,body_sha256:sha256(pr.body||''),base_sha:pr.base?.sha||null};
 const post=async(context,state,description)=>{if(publish)await api.request(root+'/statuses/'+head,{context,state,description:description.slice(0,140),target_url:runUrl})};
 const aggregate={schema_version:'spu-pr-quality-v1',engine_version:ENGINE_VERSION,source,state:'running',reports:[],errors:[]};
 await fs.mkdir(outDirectory,{recursive:true,mode:0o700});
 const save=async()=>{await fs.writeFile(path.join(outDirectory,'report.json'),JSON.stringify(aggregate,null,2)+'\n',{mode:0o600});await fs.writeFile(path.join(outDirectory,'report.md'),['# SPU PR quality',`PR #${number} · ${head}`,`State: ${aggregate.state}`,aggregate.errors.length?'Inspection unavailable; this is not a passing result.':'',...aggregate.reports.map(renderReport)].join('\n\n'),{mode:0o600})};
 let temp;
 try{
  if(pr.state!=='open'||pr.draft){aggregate.state=pr.draft?'draft':'closed';await post('submission-quality','pending','Quality inspection waits for an open, ready PR');await post('ai-completeness','pending','AI completeness review has not run');await save();return aggregate}
  await post('submission-quality','pending','Inspecting plan and workbook at this commit');
  await post('ai-completeness','pending',reviewer?'AI review waits for input checks':'AI reviewer is not configured for this run');
  const files=await api.pages(root+'/pulls/'+number+'/files');
  if(files.length!==pr.changed_files)throw new Error('Incomplete PR file list');
  const {tasks,mixed}=intakeScope(files);
  if(!tasks.length){aggregate.state='not_applicable';await post('submission-quality','success','Not applicable: no task intake directory changed');await post('ai-completeness','pending','No task intake content inspected');await save();return aggregate}
  if(mixed)throw new Error('Separate task submissions from infrastructure or workflow changes');
  const tree=await api.get(root+'/git/trees/'+head+'?recursive=1');
  if(tree.truncated||!Array.isArray(tree.tree)||tree.tree.length>100000)throw new Error('Incomplete or excessive repository tree');
  temp=await fs.mkdtemp(path.join(os.tmpdir(),'spu-pr-quality-'));
  for(const taskId of tasks){
   const prefix='submissions/'+taskId+'/',entries=tree.tree.filter(e=>e.path?.startsWith(prefix));
   if(!entries.length||entries.length>300||entries.some(e=>e.type!=='tree'&&(e.type!=='blob'||!['100644','100755'].includes(e.mode)))||entries.some(e=>!e.path.slice(prefix.length)||e.path.split('/').some(x=>x==='.'||x==='..')||e.path.includes('\\')))throw new Error('Deleted, linked or unsupported task directory');
   const manifest=entries.filter(e=>e.type==='blob').map(e=>({path:e.path.slice(prefix.length),sha:e.sha,size:e.size})).sort((a,b)=>a.path.localeCompare(b.path));
   if(new Set(manifest.map(e=>e.path)).size!==manifest.length||manifest.some(e=>!/^[a-f0-9]{40}$/.test(e.sha||'')||!Number.isSafeInteger(e.size)||e.size<0))throw new Error('Invalid task tree manifest');
   const directory=path.join(temp,taskId);await fs.mkdir(directory);
   const selected=manifest.filter(e=>['task-plan.md','reference-rankings.xlsx','submission.zip'].includes(e.path));
   for(const entry of selected){
    if(!Number.isSafeInteger(entry.size)||entry.size<1||entry.size>MAX_BLOB||entry.path==='task-plan.md'&&entry.size>128*1024||!/^[a-f0-9]{40}$/.test(entry.sha))throw new Error('Required file is oversized or unsupported');
    const blob=await api.get(root+'/git/blobs/'+entry.sha);
    if(blob.encoding!=='base64'||typeof blob.content!=='string'||blob.size!==entry.size||blob.content.length>12*1024*1024)throw new Error('Unsupported GitHub blob response');
    const raw=Buffer.from(blob.content,'base64');if(raw.length!==entry.size)throw new Error('Downloaded blob size mismatch');
    // Verify Git's blob identity, not only the mutable PR metadata.
    const {createHash}=await import('node:crypto');if(createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex')!==entry.sha)throw new Error('Downloaded blob hash mismatch');
    await fs.writeFile(path.join(directory,entry.path),raw,{flag:'wx',mode:0o600});
   }
   if(typeof pr.body!=='string'&&pr.body!==null||Buffer.byteLength(pr.body||'')>64000)throw new Error('PR description exceeds inspection limit');
   const report=await reviewSubmission({directory,taskId,body:pr.body||'',source:{...source,tree_digest:sha256(JSON.stringify(manifest))},reviewer});
   aggregate.reports.push(report);
  }
  // A changed or closed PR cannot inherit this run's result on a newer revision.
  const current=await api.get(root+'/pulls/'+number);
  if(current.head?.sha!==head||(current.base?.sha||null)!==source.base_sha||current.state!=='open'||current.draft||sha256(current.body||'')!==source.body_sha256){aggregate.state='stale';await post('submission-quality','pending','PR changed during inspection; results are for an older commit');await post('ai-completeness','pending','PR changed; this report is not current');await save();return aggregate}
  const unavailable=aggregate.reports.some(r=>r.rules.state==='error'||r.ai.state==='error');
  const failed=aggregate.reports.some(r=>r.rules.outcome!=='passed'),aiUnavailable=aggregate.reports.some(r=>r.ai.state!=='completed'),aiChanges=aggregate.reports.some(r=>r.ai.outcome==='needs_changes');
  aggregate.state=unavailable?'error':failed||aiChanges?'needs_changes':aiUnavailable?'rules_only':'reviewed';
  await post('submission-quality',aggregate.reports.some(r=>r.rules.state==='error')?'error':failed?'failure':'success',failed?'Plan/data corrections required; open the quality report':'Plan/workbook rule checks passed; scientific validity is not established');
  await post('ai-completeness',unavailable?'error':aiUnavailable?'pending':aiChanges?'failure':'success',aiUnavailable?'AI review unavailable or not run; see report':aiChanges?'AI completeness findings require changes':'AI found no completeness blockers; not scientific or merge approval');
  await save();return aggregate;
 }catch(e){
  aggregate.state='error';aggregate.errors.push({code:'INSPECTION_UNAVAILABLE',message:'The PR could not be completely inspected. Check its file scope, input limits and service availability.'});await save();
  // Never serialize provider errors, credentials, raw workbook values or network response bodies.
  await post('submission-quality','error','Quality inspection unavailable; no passing result');await post('ai-completeness','pending','AI result is unavailable for this inspection');return aggregate;
 }finally{if(temp)await fs.rm(temp,{recursive:true,force:true})}
}
