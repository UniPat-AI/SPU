/** Trusted-branch workflow only. Reads the PR event and file names; never checks out or runs PR content. */
import fs from 'node:fs/promises';
import {GitHub} from './github.mjs';
import {checkPrFormat,formatComment,FORMAT_CONTEXT} from '../quality/pr-format.mjs';
const repo=process.env.GITHUB_REPOSITORY,api=new GitHub(),marker='<!-- spu-pr-format -->';
if(!repo||!process.env.GITHUB_TOKEN||!process.env.GITHUB_EVENT_PATH)throw new Error('GitHub Actions environment required');
const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8')),number=Number(process.env.SPU_PR||event.pull_request?.number);
if(!Number.isSafeInteger(number)||number<1)throw new Error('PR number required');
const root=`/repos/${repo}`,pr=await api.get(`${root}/pulls/${number}`);
const runUrl=`${process.env.GITHUB_SERVER_URL||'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const status=(state,description)=>api.request(`${root}/statuses/${pr.head.sha}`,{context:FORMAT_CONTEXT,state,description:description.slice(0,140),target_url:runUrl});
if(pr.state!=='open'){console.log('PR is closed; nothing to check.');process.exit(0)}
const files=await api.pages(`${root}/pulls/${number}/files`,{maxItems:3000});
if(files.length!==pr.changed_files){await status('error','Could not read the full file list; push again or ask a maintainer.');process.exit(0)}
const existingTasks=new Set();
for(const name of new Set(files.flatMap(f=>[f.filename,f.previous_filename]).map(n=>n?.match(/^submissions\/([a-z0-9][a-z0-9_-]{2,79})\//)?.[1]).filter(Boolean))){
 // A folder present on the base commit means this PR changes an existing task.
 try{await api.get(`${root}/contents/submissions/${name}?ref=${pr.base.sha}`);existingTasks.add(name)}catch(e){if(e.statusCode!==404)throw e}
}
const result=checkPrFormat({title:pr.title,body:pr.body,files,existingTasks});
const fresh=await api.get(`${root}/pulls/${number}`);
if(fresh.head.sha!==pr.head.sha||fresh.title!==pr.title||fresh.body!==pr.body){console.log('PR changed during the check; the newer event re-checks it.');process.exit(0)}
if(result.kind==='other')await status('success','Not a task PR; no submission format rules apply.');
else await status(result.problems.length?'failure':'success',result.problems.length?`${result.problems.length} format fix(es): ${result.problems[0]}`:`Title and description follow the ${result.kind} format.`);
// One comment per PR, updated in place; it is only created once there is something to fix.
const comments=await api.pages(`${root}/issues/${number}/comments`,{maxItems:1000}),mine=comments.find(c=>c.user?.login==='github-actions[bot]'&&c.body?.startsWith(marker));
if(result.kind!=='other'&&(result.problems.length||mine)){const body=formatComment(result,marker);if(mine){if(mine.body!==body)await api.request(`${root}/issues/comments/${mine.id}`,{body},'PATCH')}else await api.request(`${root}/issues/${number}/comments`,{body})}
const summary=[`### ${FORMAT_CONTEXT}`,`Kind: ${result.kind}; tasks: ${result.tasks.join(', ')||'none'}`,...result.problems.map(p=>'- '+p)].join('\n');
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
console.log(summary);
