import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {checkPrFormat,formatComment} from '../quality/pr-format.mjs';
const read=name=>fs.readFile(new URL('../.github/'+name,import.meta.url),'utf8');
const template=await read('PULL_REQUEST_TEMPLATE.md'),fixTemplate=await read('PULL_REQUEST_TEMPLATE/fix.md');
const files=id=>[{filename:`submissions/${id}/task-plan.md`},{filename:`submissions/${id}/reference-rankings.xlsx`}];
const tick=s=>s.replace(/- \[ \]/g,'- [x]');
function filled(id='organoboron-fluorescence-yield'){return tick(template)
 .replace('Task ID: <task-id>','Task ID: '+id).replace('Discipline: <Chemistry / Materials science / Biology / Medicine / Other>','Discipline: Chemistry')
 .replace('Subfield: <e.g. organocatalysis>','Subfield: Photophysics').replace(/Scientific question: <[^>]*>/,'Scientific question: Rank eight organoboron dyes by absolute fluorescence quantum yield.')
 .replace(/Prediction target and ranking direction: <[^>]*>/,'Prediction target and ranking direction: quantum yield, dimensionless, higher-first').replace(/Candidates and comparison groups: <[^>]*>/,'Candidates and comparison groups: 8 candidates, 1 group')
 .replace(/Source type: <[^>]*>/,'Source type: published research').replace(/Source title, owner and version: <[^>]*>/,'Source title, owner and version: Example et al., Nature Communications 2025')
 .replace(/DOI, URL or identifiers: <[^>]*>/,'DOI, URL or identifiers: https://doi.org/10.1038/example').replace(/License or permission to redistribute every included file: <[^>]*>/,'License or permission to redistribute every included file: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/')
 .replace(/Raw data included vs referenced: <[^>]*>/,'Raw data included vs referenced: values from Table 1 included').replace(/Restrictions or conflicts of interest: <[^>]*>/,'Restrictions or conflicts of interest: None')}
const title='[Task] organoboron-fluorescence-yield: Ranking absolute fluorescence quantum yields of eight organoboron dyes';

test('a correctly filled task PR passes',()=>{const r=checkPrFormat({title,body:filled(),files:files('organoboron-fluorescence-yield')});assert.equal(r.kind,'task');assert.deepEqual(r.problems,[])});
test('the untouched template is reported field by field, including unticked consent',()=>{
 const r=checkPrFormat({title:'Add my dataset',body:template,files:files('organoboron-fluorescence-yield')});
 for(const p of [/Title must be: \[Task\]/,/"Task ID"/,/"Discipline"/,/"Scientific question"/,/"Source type"/,/"DOI, URL or identifiers"/,/completeness items \(6 not ticked\)/,/automated AI processing authorization/])assert.ok(r.problems.some(x=>p.test(x)),String(p));
});
test('title task ID, prefix and description task ID must match the folder',()=>{
 let r=checkPrFormat({title:'[Task] other-task: Ranking absolute fluorescence quantum yields',body:filled(),files:files('organoboron-fluorescence-yield')});assert.ok(r.problems.some(p=>/must match the folder name/.test(p)));
 r=checkPrFormat({title:'[Fix] organoboron-fluorescence-yield: Ranking absolute fluorescence quantum yields',body:filled(),files:files('organoboron-fluorescence-yield')});assert.ok(r.problems.some(p=>/must start with \[Task\]/.test(p)));
 r=checkPrFormat({title,body:filled('other-task'),files:files('organoboron-fluorescence-yield')});assert.ok(r.problems.some(p=>/"Task ID" in the description/.test(p)));
 r=checkPrFormat({title:'[Task] organoboron-fluorescence-yield: dyes',body:filled(),files:files('organoboron-fluorescence-yield')});assert.ok(r.problems.some(p=>/at least 15 characters/.test(p)));
});
test('changes to an existing task folder must use the fix template and title',()=>{
 const id='amine-borane-arylation-bases',existingTasks=new Set([id]);
 let r=checkPrFormat({title:`[Task] ${id}: Updated yields for the arylation bases`,body:filled(id),files:files(id),existingTasks});assert.equal(r.kind,'fix');assert.ok(r.problems.some(p=>/must start with \[Fix\]/.test(p)));
 const body=tick(fixTemplate).replace('Task ID: <task-id>','Task ID: '+id).replace(/What is wrong: <[^>]*>/,'What is wrong: Group 3 yields use percent instead of fraction.').replace(/What this PR changes: <[^>]*>/,'What this PR changes: reference-rankings.xlsx Rankings column yield, group 3').replace(/Evidence: <[^>]*>/,'Evidence: Table S4 of the source paper').replace(/Effect on reference rankings: <[^>]*>/,'Effect on reference rankings: unchanged');
 r=checkPrFormat({title:`[Fix] ${id}: Correct the yield unit for group 3`,body,files:files(id),existingTasks});assert.deepEqual(r.problems,[]);
 r=checkPrFormat({title:`[Fix] ${id}: Correct the yield unit for group 3`,body:fixTemplate,files:files(id),existingTasks});assert.ok(r.problems.some(p=>/"What is wrong"/.test(p)));
});
test('non-task PRs are out of scope; mixed PRs are told to split',()=>{
 assert.deepEqual(checkPrFormat({title:'Update README',body:'',files:[{filename:'README.md'}]}),{kind:'other',tasks:[],problems:[]});
 const r=checkPrFormat({title,body:filled(),files:[...files('organoboron-fluorescence-yield'),{filename:'scripts/x.mjs'}]});assert.ok(r.problems.some(p=>/separate from other files/.test(p)));
});
test('multiple tasks can share one PR when the title lists all of them',()=>{
 const r=checkPrFormat({title:'[Task] task-bbb, task-aaa: Two related electrolyte conductivity rankings',body:filled('task-aaa, task-bbb'),files:[...files('task-aaa'),...files('task-bbb')]});assert.deepEqual(r.problems,[]);
});
test('HTML comments in the template are ignored when reading fields',()=>{const body=filled().replace('Task ID: organoboron-fluorescence-yield','Task ID:')+'\n<!-- Task ID: organoboron-fluorescence-yield -->';assert.ok(checkPrFormat({title,body,files:files('organoboron-fluorescence-yield')}).problems.some(p=>/Fill in "Task ID"/.test(p)))});
test('author comment lists every problem and the expected title',()=>{const r=checkPrFormat({title:'x',body:'',files:files('task-aaa')}),c=formatComment(r,'<!-- m -->');assert.ok(c.startsWith('<!-- m -->'));assert.match(c,/`\[Task\] <task-id>: <scientific title>`/);assert.equal(c.split('\n- ').length-1,r.problems.length)});
test('a walkthrough PR may prefix its title with [DEMO] and is otherwise checked as usual',()=>{
 const id='organoboron-fluorescence-yield',body=filled(),f=files(id);
 assert.deepEqual(checkPrFormat({title:'[DEMO] '+title,body,files:f}).problems,[]);
 assert.ok(checkPrFormat({title:'[DEMO] '+id+': missing the task prefix',body,files:f}).problems.some(p=>p.startsWith('Title must be')));
 assert.ok(checkPrFormat({title:'[Demo] [Task] '+id+': lower-case marker is not accepted',body,files:f}).problems.length>0);
});
