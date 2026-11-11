/** Pure domain rules. Historical human approvals never grant current acceptance. */
export function derive(pr, _legacyPolicy, required = []) {
  const checks = required.map(name => {
    const item = (pr.checks || []).filter(c => c.name === name && c.trusted === true)
      .sort((a,b) => a.at.localeCompare(b.at)).at(-1);
    return item ? {...item, status: item.sha === pr.head_sha ? item.status : 'stale'} : {name, status: 'not_run'};
  });
  let status, action;
  if (pr.state === 'merged') { status = pr.release ? 'released' : 'accepted'; action = 'none'; }
  else if (pr.state === 'closed') { status = 'closed'; action = 'none'; }
  else if (pr.draft) { status = 'draft'; action = 'author'; }
  else if (!pr.triaged) { status = 'triage'; action = 'maintainer'; }
  else if (checks.some(c => c.status === 'failed')) { status = 'changes'; action = 'author'; }
  else if (!checks.length || checks.some(c => c.status !== 'passed')) { status = 'checks'; action = 'maintainer'; }
  else { status = 'review'; action = 'maintainer'; }
  // Commit statuses are not full revision/body-bound AI reports or merge authorization.
  // Keep empty legacy fields for old snapshot consumers, without computing retired roles.
  const {assignments, requested_reviewers, reviews, ...record} = pr;
  return {...record, reviewers: [], checks, status, action, approvals: 0, merge_ready: false};
}
export function answerRelations(answer) {
  const ids = answer.candidate_ids;
  if (!Array.isArray(ids) || ids.length < 2 || ids.some(x => typeof x !== 'string') || new Set(ids).size !== ids.length)
    throw new Error('candidate_ids 必须是至少两个不重复的字符串');
  const known = new Set(ids), parent = new Map(ids.map(x => [x,x]));
  const root = x => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  const pair = p => { if (!Array.isArray(p) || p.length !== 2 || p[0] === p[1] || !p.every(x => known.has(x))) throw new Error('无效的候选关系'); };
  const ties = answer.ties || [], edges = answer.strict_relations || [], unknown = answer.unknown_pairs || [];
  for (const p of ties) { pair(p); parent.set(root(p[0]), root(p[1])); }
  const graph = new Map(ids.map(x => [root(x), new Set()]));
  for (const p of edges) { pair(p); const a=root(p[0]),b=root(p[1]); if(a===b) throw new Error('严格关系与并列冲突'); graph.get(a).add(b); }
  const reach = (a,b,seen=new Set()) => { if(seen.has(a)) return false; seen.add(a); return graph.get(a).has(b) || [...graph.get(a)].some(n=>reach(n,b,seen)); };
  for (const a of graph.keys()) if(reach(a,a)) throw new Error('严格关系存在环');
  for (const p of unknown) { pair(p); const a=root(p[0]),b=root(p[1]); if(a===b || reach(a,b) || reach(b,a)) throw new Error('未知关系与已知关系冲突'); }
  const expected=[];
  for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++) {
    const a=root(ids[i]),b=root(ids[j]);
    if(a===b) expected.push([ids[i],ids[j],0]);
    else if(reach(a,b)) expected.push([ids[i],ids[j],-1]);
    else if(reach(b,a)) expected.push([ids[i],ids[j],1]);
  }
  if(!expected.length) throw new Error('没有可评分关系');
  return expected;
}
export function score(answer, groups) {
  const expected=answerRelations(answer), flat=Array.isArray(groups) ? groups.flat() : [];
  if(!Array.isArray(groups) || groups.some(g=>!Array.isArray(g)||!g.length) || flat.length!==answer.candidate_ids.length
    || new Set(flat).size!==flat.length || flat.some(x=>!answer.candidate_ids.includes(x)))
    return {valid:false, score:0, error:'输出须为有序分组，且每个候选恰好出现一次'};
  const ranks=new Map(groups.flatMap((g,i)=>g.map(x=>[x,i])));
  const correct=expected.filter(([a,b,d])=>Math.sign(ranks.get(a)-ranks.get(b))===d).length;
  return {valid:true, score:correct/expected.length, correct, total:expected.length};
}
export function allowEvaluation(config, estimated, spent=0) {
  if(!config.enabled) return {allowed:false, reason:'付费评测未启用'};
  if(!Number.isFinite(config.per_run_limit_usd)||!Number.isFinite(config.monthly_budget_usd)||config.per_run_limit_usd<=0||config.monthly_budget_usd<=0) return {allowed:false, reason:'缺少有效预算上限'};
  if(!Number.isFinite(estimated)||estimated<=0 || !Number.isFinite(spent)||spent<0) return {allowed:false, reason:'缺少有效费用估算'};
  if(estimated>config.per_run_limit_usd || spent+estimated>config.monthly_budget_usd) return {allowed:false, reason:'预算不足'};
  return {allowed:true};
}
export function statsOf(prs, proposals, issues, domains) {
  const tasks = new Map(prs.filter(p=>p.kind==='task' && p.state==='merged' && p.lifecycle!=='archived' && p.lifecycle!=='suspended').flatMap(p=>(p.task_ids||[]).map(id=>[id,p])));
  return {open:prs.filter(p=>p.state==='open'&&!p.draft).length, review:prs.filter(p=>['review','final','unassigned'].includes(p.status)).length,
    changes:prs.filter(p=>p.status==='changes').length, ready:prs.filter(p=>p.status==='ready').length,
    released:[...tasks.values()].filter(p=>p.release).length, accepted:tasks.size,
    proposals:proposals.length, issues:issues.filter(i=>i.state==='open').length,
    coverage:domains.map(d=>({...d, released:[...tasks.values()].filter(p=>p.release&&p.domain===d.id).length,
      review:prs.filter(p=>p.kind==='task'&&p.state==='open'&&p.domain===d.id).length,
      proposed:proposals.filter(p=>p.domain===d.id && p.status==='pending').length}))};
}
