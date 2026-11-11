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

export function checkPrFormat({title,body,files,existingTasks=new Set()}){
 const names=files.flatMap(f=>[f.filename,...(f.previous_filename?[f.previous_filename]:[])]);
 const tasks=[...new Set(names.map(n=>n.match(TASK_DIR)?.[1]).filter(Boolean))].sort();
 if(!tasks.length)return {kind:'other',tasks,problems:[]};
 const kind=tasks.some(t=>existingTasks.has(t))?'fix':'task',problems=[];
 if(kind==='fix'&&tasks.some(t=>!existingTasks.has(t)))problems.push('Add new tasks and fix existing tasks in separate PRs.');
 if(names.some(n=>!TASK_DIR.test(n)))problems.push('Keep submissions/<task-id>/ changes separate from other files; open another PR for the rest.');
 // An optional leading [DEMO] marks a walkthrough PR; the rest of the title follows the normal format.
 const m=String(title||'').trim().match(/^(?:\[DEMO\]\s+)?\[(Task|Fix)\]\s+([a-z0-9_, -]+?)\s*:\s*(.+)$/);
 const prefix=kind==='fix'?'Fix':'Task';
 if(!m)problems.push(`Title must be: ${TITLE_HELP[kind]}`);
 else{
  if(m[1]!==prefix)problems.push(kind==='fix'?`This PR changes an existing task, so the title must start with [Fix]: ${TITLE_HELP.fix}`:`This PR adds a new task, so the title must start with [Task]: ${TITLE_HELP.task}`);
  const ids=m[2].split(',').map(s=>s.trim()).filter(Boolean).sort();
  if(ids.join(',')!==tasks.join(','))problems.push(`Task ID in the title (${m[2].trim()}) must match the folder name: ${tasks.join(', ')}.`);
  if(m[3].trim().length<15)problems.push('Give the title a descriptive scientific summary after the colon (at least 15 characters).');
 }
 if(String(title||'').length>150)problems.push('Keep the title under 150 characters.');
 const id=field(body,'Task ID');
 if(!id)problems.push('Fill in "Task ID" in the description.');
 else if(id.split(',').map(s=>s.trim()).sort().join(',')!==tasks.join(','))problems.push(`"Task ID" in the description (${id}) must match the folder name: ${tasks.join(', ')}.`);
 const require=(label,min=3)=>{if(field(body,label).length<min)problems.push(`Fill in "${label}" in the description.`)};
 if(kind==='task'){
  const discipline=field(body,'Discipline').toLowerCase();
  if(!DISCIPLINES.includes(discipline))problems.push('"Discipline" must be one of: Chemistry, Materials science, Biology, Medicine, Other.');
  require('Subfield');require('Scientific question',20);require('Prediction target and ranking direction',10);require('Candidates and comparison groups',1);
  const source=field(body,'Source type').toLowerCase();
  if(!SOURCE_TYPES.includes(source))problems.push('"Source type" must be one of: public dataset, published research, own open data, mixed.');
  require('Source title, owner and version',5);require('DOI, URL or identifiers',5);if(field(body,'License or permission to redistribute every included file').length<15)problems.push('Describe the license or permission covering every file (name and link, at least 15 characters).');require('Raw data included vs referenced',3);
  const missing=COMPLETENESS.filter(item=>!ticked(body,item)).length;
  if(missing)problems.push(`Tick all completeness items (${missing} not ticked).`);
 }else{
  require('What is wrong',10);require('What this PR changes',10);require('Evidence',5);require('Effect on reference rankings',3);
 }
 if(!ticked(body,RIGHTS))problems.push('Tick the public-release confirmation.');
 if(!ticked(body,CONSENT))problems.push('Tick the automated AI processing authorization; without it no AI review runs.');
 return {kind,tasks,problems};
}

export function formatComment(result,marker){
 if(!result.problems.length)return `${marker}\n### Submission format check\n\nThe title and description follow the SPU ${result.kind==='fix'?'fix':'task'} format.`;
 return [marker,'### Submission format check','',`This ${result.kind==='fix'?'fix':'task'} PR needs a few edits before it follows the SPU format. Edit the title or description; this check reruns automatically.`,'',...result.problems.map(p=>'- '+p),'',`Expected title: \`${TITLE_HELP[result.kind]}\``,'','Format rules: `docs/PR-FORMAT.md`.'].join('\n');
}
