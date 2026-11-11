import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';import {parseDocument} from 'yaml';
const root=path.resolve(import.meta.dirname,'..'),files=[];
async function walk(dir){for(const entry of await fs.readdir(path.join(root,dir),{withFileTypes:true})){if(entry.name==='__pycache__')continue;const name=dir+'/'+entry.name;if(entry.isDirectory())await walk(name);else if(entry.isFile())files.push(name);else throw new Error('Unexpected linked source: '+name)}}
for(const dir of ['scripts','quality','shared','tests','.github'])await walk(dir);
let js=0,yaml=0;const py=[];
for(const name of files){
 if(name.endsWith('.mjs')){const result=spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8'});if(result.status!==0)throw new Error('Invalid JavaScript: '+name+'\n'+result.stderr);js++}
 else if(/\.ya?ml$/.test(name)){const document=parseDocument(await fs.readFile(path.join(root,name),'utf8'));if(document.errors.length)throw new Error('Invalid YAML: '+name);yaml++}
 else if(name.endsWith('.py'))py.push(path.join(root,name));
}
const result=spawnSync('python3',['-I','-c','import ast,json,sys\nfrom pathlib import Path\nfor p in json.load(sys.stdin): ast.parse(Path(p).read_text(),filename=p)'],{input:JSON.stringify(py),encoding:'utf8'});if(result.status!==0)throw new Error('Python syntax check failed: '+result.stderr);
console.log(JSON.stringify({javascript:js,python:py.length,yaml,syntax:'passed',note:'Syntax only; deployment and workflow behavior need separate checks.'}));
