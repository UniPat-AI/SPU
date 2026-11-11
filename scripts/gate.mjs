/** Trusted-branch workflow only. Downloads PR text data, never executes PR code. */
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {GitHub} from './github.mjs';import {intakeScope} from '../quality/github.mjs';import {auditEntries} from './storage.mjs';import {validateTask} from './validate.mjs';
const repo=process.env.GITHUB_REPOSITORY,api=new GitHub();
if(!repo||!process.env.GITHUB_TOKEN)throw new Error('需要 GitHub 工作流环境');
const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
const requested=event.pull_request?.number || (event.issue?.pull_request?event.issue.number:null);
const items=requested?[await api.get(`/repos/${repo}/pulls/${requested}`)]:await api.pages(`/repos/${repo}/pulls?state=open`);
for(const row of items){
 const pr=await api.get(`/repos/${repo}/pulls/${row.number}`);if(pr.state!=='open')continue;
 const sha=pr.head.sha,url=`https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const status=(context,state,description)=>api.request(`/repos/${repo}/statuses/${sha}`,{context,state,description:description.slice(0,120),target_url:url});
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'spu-gate-'));
 try {
  const files=await api.pages(`/repos/${repo}/pulls/${pr.number}/files`);
  if(files.length!==pr.changed_files)throw new Error('文件列表不完整');
  const intake=intakeScope(files);if(intake.mixed)throw new Error('Separate intake from infrastructure changes');
  if(intake.tasks.length){
   await status('task-validation','success','Not applicable to plan/data intake; see spu/clarity-audit for AI review');
   await status('reference-validation','success','Executable reference validation is a later stage, not an intake requirement');
   continue;
  }
  const dirs=[...new Set(files.map(f=>f.filename.match(/^(?:benchmark\/)?tasks\/[^/]+\/[^/]+(?=\/)/)?.[0]).filter(Boolean))];
  // Docs, workflow and code PRs carry no task: they are reviewed by maintainers, not failed as broken tasks.
  if(!dirs.length){
   await status('task-validation','success','Not applicable: no task directory changed; maintainers review this PR');
   await status('reference-validation','success','Not applicable: no task directory changed');
   continue;
  }
  await status('review-gate','pending','AI review is not connected to executable release validation');
  const forbidden=files.some(f=>!f.filename.startsWith('tasks/')&&!f.filename.startsWith('benchmark/tasks/')&&!f.filename.startsWith('docs/'));
  if(forbidden)throw new Error('任务 PR 不得同时修改工作流、审核政策或评分器');
  const tree=await api.get(`/repos/${repo}/git/trees/${sha}?recursive=1`);
  if(tree.truncated)throw new Error('Task tree is incomplete');
  for(let i=0;i<dirs.length;i++){
   const local=path.join(tmp,String(i));await fs.mkdir(local);
   for(const name of ['task.yaml','answer.json','prompt.txt','provenance.json','rationale.md','reference.json','submission.json'])
    await fs.writeFile(path.join(local,name),await api.file(repo,sha,dirs[i]+'/'+name));
   const entries=tree.tree.filter(f=>f.type==='blob'&&f.path.startsWith(dirs[i]+'/')).map(f=>({path:f.path.slice(dirs[i].length+1),bytes:f.size,symlink:f.mode==='120000'}));
   let manifest={schema_version:'1.0',assets:[]};
   if(entries.some(f=>f.path==='assets.json')){const raw=await api.file(repo,sha,dirs[i]+'/assets.json');manifest=JSON.parse(raw);await fs.writeFile(path.join(local,'assets.json'),raw);}
   const storage=auditEntries(entries,manifest);if(!storage.ok)throw new Error(storage.errors.join('; '));
   await validateTask(local);
  }
  await status('task-validation','success','任务结构、来源引用和答案关系校验通过');await status('reference-validation','success','参考答案满足评分契约');
 }catch(e){await status('task-validation','failure',e.message);await status('reference-validation','error','任务未完成验证');console.error(`PR #${pr.number}: ${e.message}`)}
 finally{await fs.rm(tmp,{recursive:true,force:true})}
 const fresh=await api.get(`/repos/${repo}/pulls/${pr.number}`);
 if(fresh.head.sha!==sha){console.log(`PR #${pr.number} changed; this run only applies to the old SHA`);continue;}
 // Fail closed until an authenticated AI report for this exact SHA is integrated.
 // Legacy review comments, labels and GitHub approvals cannot satisfy this check.
 await status('review-gate','pending','AI review is not connected; no trusted report for this commit');
 console.log(`PR #${pr.number} ${sha.slice(0,8)}: AI review not connected`);
}
