import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import Ajv from 'ajv';
import {parse} from 'yaml';
import {answerRelations,score} from './core.mjs';
import {auditTask} from './storage.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
export async function readSafe(root, name, limit=1048576) {
  const base=await fs.realpath(root), target=path.resolve(base,name);
  if(!target.startsWith(base+path.sep)) throw new Error('路径越界');
  const stat=await fs.lstat(target);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>limit) throw new Error('只允许有限大小的普通文件');
  const real=await fs.realpath(target);
  if(!real.startsWith(base+path.sep)) throw new Error('路径包含外部链接');
  return fs.readFile(target,'utf8');
}
export async function validateTask(dir) {
  const storage=await auditTask(dir);
  if(!storage.ok)throw new Error(storage.errors.join('; '));
  const ajv=new Ajv({allErrors:true}), data={};
  for(const [name,file] of [['task','task.yaml'],['answer','answer.json'],['provenance','provenance.json'],['submission','submission.json']]) {
    const raw=await readSafe(dir,file); data[name]=name==='task'?parse(raw):JSON.parse(raw);
    const schema=JSON.parse(await fs.readFile(path.join(ROOT,'benchmark/schemas',name+'.schema.json'),'utf8'));
    const check=ajv.compile(schema);
    if(!check(data[name])) throw new Error(`${file}: ${ajv.errorsText(check.errors)}`);
  }
  const {task,answer,provenance}=data;
  if(task.task_id!==answer.task_id || JSON.stringify([...task.candidate_ids].sort())!==JSON.stringify([...answer.candidate_ids].sort())) throw new Error('任务与答案的候选项或 ID 不一致');
  if(JSON.stringify(task.scorer)!==JSON.stringify(answer.scorer)) throw new Error('评分器版本不一致');
  if(new Set(provenance.sources.map(s=>s.id)).size!==provenance.sources.length) throw new Error('来源 ID 重复');
  if(task.source_ids.some(id=>!provenance.sources.some(s=>s.id===id))) throw new Error('来源引用缺失');
  const site=JSON.parse(await fs.readFile(path.join(ROOT,'config/site.json'),'utf8'));
  if(!site.domains.some(d=>d.id===task.domain)) throw new Error('未注册学科');
  const prompt=await readSafe(dir,'prompt.txt');
  if(prompt.trim().length<20) throw new Error('任务输入过短');
  const rationale=await readSafe(dir,'rationale.md');
  if(!rationale.trim()) throw new Error('缺少答案依据');
  const relations=answerRelations(answer);
  const reference=JSON.parse(await readSafe(dir,'reference.json'));
  const result=score(answer,reference);
  if(!result.valid||result.score!==1) throw new Error('参考答案不满足评分契约');
  return {task_id:task.task_id, domain:task.domain, relations:relations.length, files:7, reference:result, storage};
}
export async function taskDirs(root) {
  const out=[];
  async function walk(dir,depth=0) {
    if(depth>6) throw new Error('任务目录过深');
    const entries=await fs.readdir(dir,{withFileTypes:true});
    if(entries.some(e=>e.isSymbolicLink())) throw new Error('任务树不允许软链接');
    if(entries.some(e=>e.name==='task.yaml')) {out.push(dir);return;}
    for(const e of entries) if(e.isDirectory()) await walk(path.join(dir,e.name),depth+1);
  }
  await walk(root);return out;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const dirs=await taskDirs(path.resolve(process.argv[2]||'benchmark/tasks'));
    if(!dirs.length) throw new Error('没有发现任务，不能报告验证通过');
    const results=[];
    for(const dir of dirs) results.push(await validateTask(dir));
    if(new Set(results.map(r=>r.task_id)).size!==results.length) throw new Error('全局 task_id 重复');
    console.log(JSON.stringify({ok:true,tasks:results},null,2));
  } catch(e) {console.error(e.message);process.exitCode=1;}
}
