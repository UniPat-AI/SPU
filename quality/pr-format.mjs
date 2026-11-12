// Title and description rules for public task PRs. Pure: callers supply the PR title, body,
// changed file names and which task folders already exist on the default branch.
const TASK_DIR=/^submissions\/([a-z0-9][a-z0-9_-]{2,79})(?:\/|$)/;
const DISCIPLINES=['chemistry','materials science','biology','medicine','other'];
const SOURCE_TYPES=['public dataset','published research','own open data','mixed'];
const COMPLETENESS=['All data columns have a meaning, type, unit, allowed values and missing-value rule.','Candidate and group IDs agree between plan, inputs and workbook.','Experimental conditions, controls, measurements and processing are described.','Reference rankings have locatable evidence and a scientific rationale.','Ranking direction, ties, uncertainty, exclusions and unknown comparisons are explicit.','Reference answers and revealing evidence are separated from solver-visible inputs.'];
const RIGHTS='All included material is authorized for public release; no restricted material is attached.';
const CONSENT='I authorize automated AI processing of these materials for SPU quality review.';
export const FORMAT_CONTEXT='spu/pr-format';
export const TITLE_HELP={task:'[Task] <task-id>: <scientific title>',fix:'[Fix] <task-id>: <what this corrects>'};

const visible=body=>String(body||'').replace(/<!--[\s\S]*?-->/g,'');
function field(body,label){
 // [ \t] rather than \s: an empty field must not read the next line as its value.
 const re=new RegExp('^[ \\t]*[-*]?[ \\t]*(?:\\*\\*)?'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\*\\*)?[ \\t]*:[ \\t]*(.*)$','im');
 const value=(visible(body).match(re)?.[1]||'').trim();
 // Untouched template placeholders such as <task-id> count as empty.
 return /^<[^>]*>$/.test(value)?'':value;
}
const ticked=(body,text)=>visible(body).split('\n').some(line=>line.trim().toLowerCase()==='- [x] '+text.toLowerCase());

// Each check has an anchor in docs/PR-FORMAT.md; the summary comment links every check to its rule.
export const CHECKS={
 scope:{name:'Scope',anchor:'scope'},
 title:{name:'Title',anchor:'title'},
 'task-id':{name:'Task ID',anchor:'task-id'},
 files:{name:'Files',anchor:'files'},
 'task-fields':{name:'Task description',anchor:'task-description'},
 'fix-fields':{name:'Fix description',anchor:'fix-description'},
 source:{name:'Data source and license',anchor:'data-source-and-license'},
 completeness:{name:'Completeness checklist',anchor:'completeness-checklist'},
 confirmations:{name:'Confirmations',anchor:'confirmations'}
};
// "own open data (synthetic)" still counts as "own open data": an allowed value may be followed by a note.
const oneOf=(value,options)=>options.find(o=>value===o||value.startsWith(o+' ')||value.startsWith(o+'(')||value.startsWith(o+',')||value.startsWith(o+';'));

export function checkPrFormat({title,body,files,existingTasks=new Set()}){
 const names=files.flatMap(f=>[f.filename,...(f.previous_filename?[f.previous_filename]:[])]);
 const tasks=[...new Set(names.map(n=>n.match(TASK_DIR)?.[1]).filter(Boolean))].sort();
 if(!tasks.length)return {kind:'other',tasks,problems:[],checks:[]};
 const kind=tasks.some(t=>existingTasks.has(t))?'fix':'task';
 const ids=kind==='fix'?['scope','title','task-id','fix-fields','confirmations']:['scope','title','task-id','files','task-fields','source','completeness','confirmations'];
 const found=Object.fromEntries(ids.map(id=>[id,[]]));const add=(id,text)=>found[id].push(text);
 if(kind==='fix'&&tasks.some(t=>!existingTasks.has(t)))add('scope','Add new tasks and fix existing tasks in separate PRs.');
 if(names.some(n=>!TASK_DIR.test(n)))add('scope','Keep submissions/<task-id>/ changes separate from other files; open another PR for the rest.');
 // An optional leading [DEMO] marks a walkthrough PR; the rest of the title follows the normal format.
 const m=String(title||'').trim().match(/^(?:\[DEMO\]\s+)?\[(Task|Fix)\]\s+([a-z0-9_, -]+?)\s*:\s*(.+)$/);
 const prefix=kind==='fix'?'Fix':'Task';
 if(!m)add('title',`Title must be: ${TITLE_HELP[kind]}`);
 else{
  if(m[1]!==prefix)add('title',kind==='fix'?`This PR changes an existing task, so the title must start with [Fix]: ${TITLE_HELP.fix}`:`This PR adds a new task, so the title must start with [Task]: ${TITLE_HELP.task}`);
  const titleIds=m[2].split(',').map(s=>s.trim()).filter(Boolean).sort();
  if(titleIds.join(',')!==tasks.join(','))add('title',`Task ID in the title (${m[2].trim()}) must match the folder name: ${tasks.join(', ')}.`);
  if(m[3].trim().length<15)add('title','Give the title a descriptive scientific summary after the colon (at least 15 characters).');
 }
 if(String(title||'').length>150)add('title','Keep the title under 150 characters.');
 const id=field(body,'Task ID');
 if(!id)add('task-id','Fill in "Task ID" in the description.');
 else if(id.split(',').map(s=>s.trim()).sort().join(',')!==tasks.join(','))add('task-id',`"Task ID" in the description (${id}) must match the folder name: ${tasks.join(', ')}.`);
 const require=(check,label,min=3)=>{if(field(body,label).length<min)add(check,`Fill in "${label}" in the description.`)};
 if(kind==='task'){
  for(const task of tasks){
   const present=new Set(files.filter(f=>f.status!=='removed').map(f=>f.filename).filter(n=>n.startsWith(`submissions/${task}/`)).map(n=>n.slice(`submissions/${task}/`.length)));
   const zip=present.has('submission.zip'),loose=present.has('task-plan.md')||present.has('reference-rankings.xlsx');
   if(zip&&loose)add('files',`submissions/${task}/: use either submission.zip or loose task-plan.md and reference-rankings.xlsx, not both.`);
   else if(!zip){
    if(!present.has('task-plan.md'))add('files',`Add submissions/${task}/task-plan.md (or a single submission.zip).`);
    if(!present.has('reference-rankings.xlsx'))add('files',`Add submissions/${task}/reference-rankings.xlsx (or a single submission.zip).`);
   }
   if(task.length>80)add('files',`Shorten the task ID ${task} to at most 80 characters.`);
  }
  const discipline=field(body,'Discipline').toLowerCase();
  if(!oneOf(discipline,DISCIPLINES))add('task-fields','"Discipline" must be one of: Chemistry, Materials science, Biology, Medicine, Other.');
  require('task-fields','Subfield');require('task-fields','Scientific question',20);require('task-fields','Prediction target and ranking direction',10);require('task-fields','Candidates and comparison groups',1);
  const source=field(body,'Source type').toLowerCase();
  if(!oneOf(source,SOURCE_TYPES))add('source','"Source type" must start with one of: public dataset, published research, own open data, mixed.');
  require('source','Source title, owner and version',5);require('source','DOI, URL or identifiers',5);if(field(body,'License or permission to redistribute every included file').length<15)add('source','Describe the license or permission covering every file: its name and a link, e.g. "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)".');require('source','Raw data included vs referenced',3);
  const missing=COMPLETENESS.filter(item=>!ticked(body,item)).length;
  if(missing)add('completeness',`Tick all completeness items (${missing} not ticked).`);
 }else{
  require('fix-fields','What is wrong',10);require('fix-fields','What this PR changes',10);require('fix-fields','Evidence',5);require('fix-fields','Effect on reference rankings',3);
 }
 if(!ticked(body,RIGHTS))add('confirmations','Tick the public-release confirmation.');
 if(!ticked(body,CONSENT))add('confirmations','Tick the automated AI processing authorization; without it no AI review runs.');
 const checks=ids.map(id=>({id,...CHECKS[id],problems:found[id]}));
 return {kind,tasks,problems:checks.flatMap(c=>c.problems),checks};
}

const RULES='docs/PR-FORMAT.md';
const AI_STATE={success:'✅ Passed',failure:'❌ Changes requested',error:'⚠️ Could not finish',pending:'⏳ Running or waiting'};

// One comment per PR, updated in place: every check with its rule, the AI review, and what happens next.
export function summaryComment(result,marker,{repository,branch='main',ai=null,reportUrl=null}={}){
 const rule=anchor=>`https://github.com/${repository}/blob/${branch}/${RULES}#${anchor}`;
 const failed=result.checks.filter(c=>c.problems.length).length;
 const lines=[marker,`### Automated checks ${failed?'❌':'✅'}`,'',failed?`${failed} of ${result.checks.length} format checks need an edit. Edit the title or description, or push a change; the checks rerun automatically.`:`All ${result.checks.length} format checks pass.`,'','| Check | Result |','|---|---|'];
 for(const c of result.checks)lines.push(`| [${c.name}](${rule(c.anchor)}) | ${c.problems.length?'❌ '+c.problems.map(p=>p.replace(/\|/g,'\\|')).join('<br>'):'✅'} |`);
 const aiLine=!ai?'⏳ Waiting to start':(AI_STATE[ai.state]||ai.state)+(ai.description?` · ${ai.description}`:'');
 lines.push(`| AI review (\`spu/clarity-audit\`) | ${aiLine}${reportUrl?` · [report](${reportUrl})`:''} |`);
 // An AI review that could not run usually means the materials were incomplete; say what to do.
 if(ai?.state==='error'&&!reportUrl){
  const files=result.checks.find(c=>c.id==='files');
  lines.push('',files?.problems.length?'> **Why the AI review did not run:** it needs the task plan and the reference-rankings workbook (or one ZIP with both). Fix the **Files** check above and push; the review reruns on the new commit.':'> **Why the AI review did not run:** the review could not finish for this commit. Push again or edit the description to rerun it; if it keeps failing, ask a maintainer in a comment.');
 }
 if(result.kind==='fix')lines.push('','Expected title: `'+TITLE_HELP.fix+'`');
 else if(failed)lines.push('','Expected title: `'+TITLE_HELP.task+'`');
 lines.push('','**What happens next**','',
  '1. **Format checks** (above) rerun on every edit and push.',
  '2. **AI review** runs on the SPU server for each commit and posts a report on completeness and clarity. Address its findings by updating this PR; every push or description edit is reviewed again.',
  '3. **Maintainers** read the PR once both pass and decide on scientific acceptance. Accepted tasks are packaged and validated before they join a dataset release.',
  '',`Rules: [${RULES}](https://github.com/${repository}/blob/${branch}/${RULES}) · Review criteria: [docs/REVIEW.md](https://github.com/${repository}/blob/${branch}/docs/REVIEW.md)`);
 return lines.join('\n');
}

export function formatComment(result,marker){
 if(!result.problems.length)return `${marker}\n### Submission format check\n\nThe title and description follow the SPU ${result.kind==='fix'?'fix':'task'} format.`;
 return [marker,'### Submission format check','',`This ${result.kind==='fix'?'fix':'task'} PR needs a few edits before it follows the SPU format. Edit the title or description; this check reruns automatically.`,'',...result.problems.map(p=>'- '+p),'',`Expected title: \`${TITLE_HELP[result.kind]}\``,'','Format rules: `docs/PR-FORMAT.md`.'].join('\n');
}
