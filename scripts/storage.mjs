import fs from 'node:fs/promises';
import {createReadStream,createWriteStream,constants} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';
import Ajv from 'ajv';

const root=path.resolve(import.meta.dirname,'..');
const defaultPolicy=JSON.parse(await fs.readFile(path.join(root,'benchmark/policy/storage.json'),'utf8'));
const schema=JSON.parse(await fs.readFile(path.join(root,'benchmark/schemas/assets.schema.json'),'utf8'));
const checkSchema=new Ajv({allErrors:true}).compile(schema);
export function safeRelative(p){
 if(typeof p!=='string'||!p||p.includes('\\')||/[\x00-\x1f\x7f:]/.test(p)||p.startsWith('/')||p.split('/').some(s=>!s||s==='.'||s==='..'))throw new Error('Unsafe relative asset path');
 return p;
}
export function validateManifest(manifest,{policy=defaultPolicy,release=false}={}){
 if(!checkSchema(manifest))throw new Error('Invalid assets.json: '+JSON.stringify(checkSchema.errors));
 const ids=new Set(),paths=new Set(),sizes=new Map();
 for(const asset of manifest.assets){
  safeRelative(asset.path);
  if(ids.has(asset.id)||paths.has(asset.path))throw new Error('Duplicate asset ID or destination path');
  ids.add(asset.id);paths.add(asset.path);
  if(!policy.role_prefixes[asset.role]?.some(prefix=>asset.path.startsWith(prefix)))throw new Error('Asset role and destination disagree');
  if(sizes.has(asset.sha256)&&sizes.get(asset.sha256)!==asset.size_bytes)throw new Error('Same content hash has conflicting sizes');
  sizes.set(asset.sha256,asset.size_bytes);
  const source=asset.source;
  if(source.kind==='local'&&release)throw new Error('Release assets require a portable source');
  if(source.kind==='huggingface'){
   safeRelative(source.file);
   if(release&&!policy.approved_hf_repositories.includes(source.repo_id))throw new Error('Hugging Face repository is not approved for release');
  }
  if(source.kind==='https'){
   const url=new URL(source.url);
   if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Asset URLs must be stable HTTPS URLs without credentials, query, or fragment');
   if(release&&!policy.approved_https_origins.includes(url.origin))throw new Error('Asset origin is not approved for release');
  }
 }
 return {asset_count:manifest.assets.length,unique_objects:sizes.size,external_logical_bytes:manifest.assets.reduce((n,a)=>n+a.size_bytes,0),external_unique_bytes:[...sizes.values()].reduce((a,b)=>a+b,0)};
}
export function auditEntries(entries,manifest={schema_version:'1.0',assets:[]},{policy=defaultPolicy,release=false}={}){
 const external=validateManifest(manifest,{policy,release}),errors=[],names=new Set();let bytes=0;
 if(entries.length>policy.max_files_per_task)errors.push('Too many task source files');
 for(const file of entries){
  safeRelative(file.path);
  if(names.has(file.path))errors.push('Duplicate source path: '+file.path);names.add(file.path);
  if(!Number.isSafeInteger(file.bytes)||file.bytes<0)throw new Error('Invalid file size');
  bytes+=file.bytes;
  const parts=file.path.split('/');
  if(file.symlink)errors.push('Symlinks are not allowed: '+file.path);
  if(parts.slice(0,-1).some(p=>policy.excluded_directory_names.includes(p))||policy.excluded_root_directories.includes(parts[0]))errors.push('Runtime or dependency output in task source: '+file.path);
  if(file.bytes>policy.inline_file_limit_bytes)errors.push('File exceeds inline budget; use assets.json: '+file.path);
  if(file.lfs_pointer)errors.push('LFS pointers are not payloads; use assets.json: '+file.path);
 }
 if(bytes>policy.inline_task_limit_bytes)errors.push('Task source exceeds inline budget');
 for(const a of manifest.assets)if(names.has(a.path))errors.push('External asset also exists in source tree: '+a.path);
 const format=names.has('task.yaml')?(names.has('task.toml')?'spu+harbor':'spu'):names.has('task.toml')?'harbor':'unknown';
 return {ok:!errors.length,format,source_files:entries.length,inline_bytes:bytes,...external,largest_files:[...entries].sort((a,b)=>b.bytes-a.bytes).slice(0,5),errors,
  note:'Source bytes exclude container images, expanded archives, runtime scratch space, and trial outputs.'};
}
export async function readManifest(file){
 const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size>1048576)throw new Error('Manifest must be a regular file under 1 MiB');
 const m=JSON.parse(await fs.readFile(file,'utf8'));validateManifest(m);return m;
}
export async function auditTask(dir,options={}){
 const base=await fs.realpath(dir),entries=[];
 async function walk(current,depth=0){
  if(depth>20)throw new Error('Task source is too deeply nested');
  for(const e of await fs.readdir(current,{withFileTypes:true})){
   const full=path.join(current,e.name),relative=path.relative(base,full).split(path.sep).join('/'),s=await fs.lstat(full);
   if(s.isSymbolicLink()){entries.push({path:relative,bytes:0,symlink:true});continue;}
   if(s.isDirectory()){
    if(defaultPolicy.excluded_directory_names.includes(e.name)||(!depth&&defaultPolicy.excluded_root_directories.includes(e.name)))entries.push({path:relative+'/.excluded',bytes:0});
    else await walk(full,depth+1);
   }else if(s.isFile()){
    let lfs=false;
    if(s.size<1024){const content=await fs.readFile(full,'utf8');lfs=content.startsWith('version https://git-lfs.github.com/spec/v1');}
    entries.push({path:relative,bytes:s.size,lfs_pointer:lfs});
   }else throw new Error('Non-regular source file: '+relative);
   if(entries.length>defaultPolicy.max_files_per_task+1)throw new Error('Too many source files');
  }
 }
 await walk(base);
 let manifest={schema_version:'1.0',assets:[]};
 if(entries.some(e=>e.path==='assets.json'))manifest=await readManifest(path.join(base,'assets.json'));
 return auditEntries(entries,manifest,options);
}
export async function fingerprint(file){
 const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink())throw new Error('Blob must be a regular file');
 const hash=createHash('sha256');let size=0;
 for await(const chunk of createReadStream(file,{flags:constants.O_RDONLY|constants.O_NOFOLLOW})){hash.update(chunk);size+=chunk.length;}
 return {sha256:hash.digest('hex'),size_bytes:size};
}
async function verified(file,asset){const actual=await fingerprint(file);if(actual.sha256!==asset.sha256||actual.size_bytes!==asset.size_bytes)throw new Error('Blob checksum or size mismatch');return actual;}
async function objectPath(store,sha,{create=false}={}){
 if(!/^[a-f0-9]{64}$/.test(sha))throw new Error('Invalid object hash');
 if(create)await fs.mkdir(store,{recursive:true,mode:0o775});
 const base=await fs.realpath(store);let current=base;
 for(const part of ['sha256',sha.slice(0,2)]){
  current=path.join(current,part);if(create)await fs.mkdir(current,{mode:0o775}).catch(e=>{if(e.code!=='EEXIST')throw e});
  const st=await fs.lstat(current);if(!st.isDirectory()||st.isSymbolicLink())throw new Error('Unsafe object-store directory');
 }
 return path.join(current,sha);
}
export async function ingestBlob(asset,file,store){
 await verified(file,asset);const target=await objectPath(store,asset.sha256,{create:true});
 try{await verified(target,asset);return {object:target,reused:true};}catch(e){if(e.code!=='ENOENT')throw e;}
 const tmp=target+'.tmp-'+randomUUID();
 try{
  await pipeline(createReadStream(file,{flags:constants.O_RDONLY|constants.O_NOFOLLOW}),createWriteStream(tmp,{flags:'wx',mode:0o664}));
  await verified(tmp,asset);await fs.rename(tmp,target);
 }catch(e){await fs.rm(tmp,{force:true});throw e;}
 return {object:target,reused:false};
}
export async function materialize(manifest,store,out,role){
 validateManifest(manifest);
 if(!['input','verification','provenance'].includes(role))throw new Error('Select exactly one explicit asset role');
 const assets=manifest.assets.filter(a=>a.role===role),objects=[];
 // Verify every source before creating any output. No network access or shell execution.
 for(const a of assets){const source=await objectPath(store,a.sha256);await verified(source,a);objects.push({a,source});}
 await fs.mkdir(out,{mode:0o775}); // Existing destinations are never overwritten.
 for(const {a,source} of objects){const target=path.join(out,...safeRelative(a.path).split('/'));await fs.mkdir(path.dirname(target),{recursive:true,mode:0o775});await fs.copyFile(source,target,constants.COPYFILE_EXCL);await verified(target,a);}
 return {role,files:assets.length,bytes:assets.reduce((n,a)=>n+a.size_bytes,0),output:path.resolve(out)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [cmd,arg,...rest]=process.argv.slice(2),opt=k=>{const i=rest.indexOf(k);return i<0?undefined:rest[i+1]};
  if(cmd==='audit'){
   const report=await auditTask(arg,{release:rest.includes('--release')});console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
  }else if(cmd==='ingest'){
   const m=await readManifest(arg),asset=m.assets.find(a=>a.id===opt('--asset'));if(!asset||!opt('--file')||!opt('--store'))throw new Error('ingest requires --asset, --file, and --store');
   console.log(JSON.stringify(await ingestBlob(asset,opt('--file'),opt('--store')),null,2));
  }else if(cmd==='materialize'){
   if(!opt('--store')||!opt('--out')||!opt('--role'))throw new Error('materialize requires --store, --out, and --role');
   console.log(JSON.stringify(await materialize(await readManifest(arg),opt('--store'),opt('--out'),opt('--role')),null,2));
  }else throw new Error('Usage: storage.mjs audit TASK [--release] | ingest MANIFEST --asset ID --file FILE --store DIR | materialize MANIFEST --store DIR --out NEW_DIR --role input|verification|provenance');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
