/** Trusted-branch workflow only. Reads the PR event and file names; never checks out or runs PR content. */
import fs from 'node:fs/promises';
import {GitHub} from './github.mjs';
import {checkPrFormat,summaryComment,FORMAT_CONTEXT} from '../quality/pr-format.mjs';
const repo=process.env.GITHUB_REPOSITORY,api=new GitHub(),marker='<!-- spu-pr-format -->',AI_CONTEXT='spu/clarity-audit';
if(!repo||!process.env.GITHUB_TOKEN||!process.env.GITHUB_EVENT_PATH)throw new Error('GitHub Actions environment required');
const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8')),root=`/repos/${repo}`;
const runUrl=`${process.env.GITHUB_SERVER_URL||'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;

// A status event from the AI review only refreshes the summary of the PRs on that commit.
let numbers;
if(event.context!==undefined){
 if(event.context!==AI_CONTEXT){console.log(`Ignoring status ${event.context}.`);process.exit(0)}
 numbers=(await api.get(`${root}/commits/${event.sha}/pulls`)).filter(p=>p.state==='open').map(p=>p.number);
}else numbers=[Number(process.env.SPU_PR||event.pull_request?.number)];

for(const number of numbers){
 if(!Number.isSafeInteger(number)||number<1)throw new Error('PR number required');
 const pr=await api.get(`${root}/pulls/${number}`);
 if(pr.state!=='open'){console.log(`PR #${number} is closed; nothing to check.`);continue}
 const status=(state,description)=>api.request(`${root}/statuses/${pr.head.sha}`,{context:FORMAT_CONTEXT,state,description:description.slice(0,140),target_url:runUrl});
 const files=await api.pages(`${root}/pulls/${number}/files`,{maxItems:3000});
 if(files.length!==pr.changed_files){await status('error','Could not read the full file list; push again or ask a maintainer.');continue}
 const existingTasks=new Set();
 for(const name of new Set(files.flatMap(f=>[f.filename,f.previous_filename]).map(n=>n?.match(/^submissions\/([a-z0-9][a-z0-9_-]{2,79})\//)?.[1]).filter(Boolean))){
  // A folder present on the base commit means this PR changes an existing task.
  try{await api.get(`${root}/contents/submissions/${name}?ref=${pr.base.sha}`);existingTasks.add(name)}catch(e){if(e.statusCode!==404)throw e}
 }
 const result=checkPrFormat({title:pr.title,body:pr.body,files,existingTasks});
 const fresh=await api.get(`${root}/pulls/${number}`);
 if(fresh.head.sha!==pr.head.sha||fresh.title!==pr.title||fresh.body!==pr.body){console.log(`PR #${number} changed during the check; the newer event re-checks it.`);continue}
 const failed=result.checks.filter(c=>c.problems.length);
 if(result.kind==='other')await status('success','Not a task PR; no submission format rules apply.');
 else await status(failed.length?'failure':'success',failed.length?`${failed.length} of ${result.checks.length} checks need an edit: ${failed.map(c=>c.name).join(', ')}`:`All ${result.checks.length} format checks pass.`);
 if(result.kind==='other')continue;
 // The AI review's status for this exact commit, and the latest report it posted.
 const statuses=await api.pages(`${root}/commits/${pr.head.sha}/statuses`,{maxItems:300});
 const ai=statuses.find(s=>s.context===AI_CONTEXT);
 const comments=await api.pages(`${root}/issues/${number}/comments`,{maxItems:1000});
 const report=comments.filter(c=>c.body?.startsWith('<!-- spu-clarity:')).at(-1);
 const body=summaryComment(result,marker,{repository:repo,branch:event.repository?.default_branch||'main',ai:ai&&{state:ai.state,description:ai.description},reportUrl:report?.html_url});
 // One comment per PR, updated in place.
 const mine=comments.find(c=>c.user?.login==='github-actions[bot]'&&c.body?.startsWith(marker));
 if(mine){if(mine.body!==body)await api.request(`${root}/issues/comments/${mine.id}`,{body},'PATCH')}else await api.request(`${root}/issues/${number}/comments`,{body});
 const summary=[`### ${FORMAT_CONTEXT} · PR #${number}`,`Kind: ${result.kind}; tasks: ${result.tasks.join(', ')||'none'}`,...result.checks.map(c=>`- ${c.problems.length?'✗':'✓'} ${c.name}${c.problems.length?': '+c.problems.join(' '):''}`),`- AI review: ${ai?.state||'not started'}`].join('\n');
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
 console.log(summary);
}
