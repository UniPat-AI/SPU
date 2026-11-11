import {setTimeout as delay} from 'node:timers/promises';
/** The origin is fixed; never send a token to content-supplied URLs. */
export class GitHub {
 constructor(token=process.env.GITHUB_TOKEN,fetcher=fetch){this.token=token;this.fetcher=fetcher;this.requests=0;}
 async request(endpoint,body,method=body?'POST':'GET') {
  if(!endpoint.startsWith('/') || endpoint.startsWith('//'))throw new Error('Invalid GitHub API path');
  for(let attempt=0;attempt<4;attempt++) {
   this.requests++;
   const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'spu-community'};
   if(this.token)headers.Authorization=`Bearer ${this.token}`;
   if(body)headers['Content-Type']='application/json';
   const response=await this.fetcher('https://api.github.com'+endpoint,{method,redirect:'error',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
   if([429,502,503,504].includes(response.status)||(response.status===403&&response.headers.get('x-ratelimit-remaining')==='0')) {
    if(attempt===3)throw new Error(`GitHub 暂时不可用或限流 (${response.status})`);
    await delay(Math.min(15000,Math.max(1000,Number(response.headers.get('retry-after')||0)*1000,1000*2**attempt)));continue;
   }
   if(!response.ok)throw Object.assign(new Error(`GitHub API ${response.status}: ${endpoint.split('?')[0]}`),{statusCode:response.status});
   let text='',size=0;const decoder=new TextDecoder();for await(const chunk of response.body){size+=chunk.length;if(size>16*1024*1024)throw new Error('GitHub response size limit exceeded');text+=decoder.decode(chunk,{stream:true})}text+=decoder.decode();let value;try{value=JSON.parse(text)}catch{throw new Error('Invalid GitHub JSON response')}
   if(value.errors)throw new Error('GitHub GraphQL 查询不完整');
   return {value,link:response.headers.get('link')};
  }
 }
 async get(p){return (await this.request(p)).value;}
 async pages(endpoint,{maxItems=100000}={}) {
  let next=endpoint+(endpoint.includes('?')?'&':'?')+'per_page=100',out=[];const seen=new Set();
  while(next){if(seen.has(next)||seen.size>1000)throw new Error('分页游标异常');seen.add(next);const {value,link}=await this.request(next);
   const list=Array.isArray(value)?value:value.check_runs;
   if(!Array.isArray(list))throw new Error('分页返回格式不正确');out.push(...list);if(out.length>maxItems)throw new Error('GitHub pagination item limit exceeded');
   const match=link?.match(/<([^>]+)>; rel="next"/);next=null;
   if(match){const u=new URL(match[1]);if(u.origin!=='https://api.github.com')throw new Error('分页来源异常');next=u.pathname+u.search;}
  }
  return out;
 }
 async file(repo,ref,file){
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||!file||file.split('/').some(s=>s==='..'))throw new Error('Invalid file location');
  const item=await this.get(`/repos/${repo}/contents/${file.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`);
  if(item.type!=='file'||item.encoding!=='base64'||item.size>1048576)throw new Error('文件不是受支持的小文本文件');
  return Buffer.from(item.content,'base64').toString('utf8');
 }
}
export function checkStates(statuses,sha,policy){
 const allowed=new Set(['github-actions[bot]',...(policy.maintainers||[])]);
 return statuses.filter(s=>allowed.has(s.creator?.login)).map(s=>({name:s.context,sha,status:({success:'passed',failure:'failed',error:'error',pending:'running'})[s.state]||'error',trusted:true,at:s.updated_at,url:s.target_url}));
}
