"""Bounded, read-only Markdown/XLSX intake inspection. No extraction or formula execution."""
import io, json, math, os, posixpath, re, stat, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

MAX_ZIP=8*1024*1024
MAX_EXPANDED=24*1024*1024
MAX_MEMBER=8*1024*1024
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
ROOT=Path(__file__).resolve().parent.parent
FORMAT=json.loads((ROOT/'shared/submission-format.json').read_text())
class InspectionError(ValueError): pass
if sys.platform.startswith('linux'):
    import resource
    resource.setrlimit(resource.RLIMIT_AS,(512*1024*1024,512*1024*1024))
    resource.setrlimit(resource.RLIMIT_CPU,(8,8))
findings=[]
def add(code,message,file,location='',severity='error',suggestion=''):
    if len(findings)>=150: raise InspectionError('Too many findings; reduce or correct the submission before retrying')
    findings.append(dict(code=code,severity=severity,file=file,location=location,message=message,suggestion=suggestion))
def safe_name(name):
    return bool(name) and not name.startswith('/') and '\\' not in name and not any(p in ('..','.') for p in name.split('/')) and not re.match(r'^[A-Za-z]:',name)
def archive(raw):
    if len(raw)>MAX_ZIP: raise InspectionError('Archive exceeds 8 MiB compressed limit')
    z=zipfile.ZipFile(io.BytesIO(raw)); infos=z.infolist()
    if len(infos)>500 or sum(i.file_size for i in infos)>MAX_EXPANDED: raise InspectionError('Archive expansion limit exceeded')
    names=set()
    for i in infos:
        name=i.filename
        if not safe_name(name) or name.casefold() in names: raise InspectionError('Unsafe or duplicate archive member')
        names.add(name.casefold())
        if i.flag_bits&1 or stat.S_ISLNK(i.external_attr>>16): raise InspectionError('Encrypted or symlink archive members are unsupported')
        if i.file_size>MAX_MEMBER or i.file_size>max(1,i.compress_size)*500: raise InspectionError('Archive member expansion limit exceeded')
        if i.compress_type not in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED): raise InspectionError('Unsupported ZIP compression')
    return z

def read_member(z,name):
    info=z.getinfo(name)
    if info.file_size>MAX_MEMBER: raise InspectionError('Oversized member')
    with z.open(info) as f: raw=f.read(MAX_MEMBER+1)
    if len(raw)>MAX_MEMBER or len(raw)!=info.file_size: raise InspectionError('Member size mismatch')
    return raw

def xml(z,name):
    raw=read_member(z,name)
    # Reject DTDs/entities, including UTF-16/32 declarations. No external resolution.
    if b'\x00' in raw or re.search(br'<!\s*(DOCTYPE|ENTITY)',raw,re.I): raise InspectionError('DTD/entity or unsupported XML encoding')
    return ET.fromstring(raw)

def workbook(raw):
    z=archive(raw)
    for name in z.namelist():
        lower=name.lower()
        if any(x in lower for x in ('vbaproject','macrosheets/','activex/','externallinks/','embeddings/')): raise InspectionError('Macros, external links and embedded objects are unsupported')
        if name.endswith('.rels'):
            for rel in xml(z,name):
                if rel.get('TargetMode')=='External': raise InspectionError('External workbook relationships are unsupported; use plain text evidence references')
    shared=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        shared=[''.join(e.itertext()) for e in xml(z,'xl/sharedStrings.xml').findall('s:si',NS)]
        if len(shared)>20000: raise InspectionError('Shared string limit exceeded')
    rels={x.get('Id'):x.get('Target') for x in xml(z,'xl/_rels/workbook.xml.rels')}
    result={};cells=0
    for sheet in xml(z,'xl/workbook.xml').findall('s:sheets/s:sheet',NS):
        name=sheet.get('name');target=rels.get(sheet.get('{'+REL+'}id'),'')
        if not target or '\\' in target or '..' in target.split('/'): raise InspectionError('Invalid worksheet relationship')
        member=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
        if not member.startswith('xl/worksheets/') or name in result or len(result)>=10: raise InspectionError('Unsupported worksheet structure')
        rows=[];last=0
        for row in xml(z,member).findall('s:sheetData/s:row',NS):
            rownum=int(row.get('r','0'))
            if rownum<=last or rownum>2000: raise InspectionError('Invalid or excessive worksheet rows')
            last=rownum;data={}
            for c in row.findall('s:c',NS):
                cells+=1
                if cells>100000: raise InspectionError('Workbook cell limit exceeded')
                ref=c.get('r','');m=re.fullmatch(r'([A-Z]{1,3})([1-9][0-9]*)',ref)
                if not m or int(m[2])!=rownum: raise InspectionError('Invalid cell coordinate')
                index=0
                for char in m[1]: index=index*26+ord(char)-64
                if index>100 or index in data: raise InspectionError('Duplicate or excessive column index')
                if c.find('s:f',NS) is not None: raise InspectionError('Formula cells are unsupported; submit reviewed literal values')
                kind=c.get('t','n');v=c.find('s:v',NS)
                value=v.text if v is not None and v.text else ''
                if kind=='s':
                    if not value.isdigit() or int(value)>=len(shared): raise InspectionError('Invalid shared string index')
                    value=shared[int(value)]
                elif kind=='inlineStr':value=''.join(t.text or '' for t in c.findall('.//s:t',NS))
                elif kind=='e': raise InspectionError('Workbook contains an Excel error cell')
                elif kind not in ('n','str','b','d'): raise InspectionError('Unsupported Excel cell type')
                if len(value)>8000: raise InspectionError('Cell text limit exceeded')
                data[index]=value.strip()
            if any(data.values()):rows.append((rownum,[data.get(i,'') for i in range(1,max(data,default=0)+1)]))
        result[name]=rows
    return result

def num(v):
    try:
        n=float(v)
        return n if math.isfinite(n) else None
    except (ValueError,TypeError): return None

def inspect(plan,raw,task,body):
    if len(plan.encode())>128*1024: raise InspectionError('Task plan exceeds 128 KiB')
    if '\x00' in plan: raise InspectionError('Task plan contains NUL bytes')
    sections={};heading=None;fence=None
    for line in plan.splitlines():
        marker=re.match(r'^\s*(`{3,}|~{3,})',line)
        if marker:
            token=marker[1][0]
            fence=None if fence==token else token if fence is None else fence
            if heading is not None:sections[heading]['text']+=line+'\n'
            continue
        if fence is not None:
            if heading is not None:sections[heading]['text']+=line+'\n'
            continue
        m=re.match(r'^##\s+(\d{1,2})[.)]?\s+(.+)',line)
        if m:
            heading=int(m[1])
            if heading in sections:add('PLAN_DUPLICATE_SECTION','Duplicate numbered section','task-plan.md',f'Section {heading}')
            sections[heading]={'title':m[2],'text':''}
        elif heading is not None: sections[heading]['text']+=line+'\n'
    for i,section in enumerate(FORMAT['sections'],1):
        s=sections.get(i)
        if not s:add('PLAN_MISSING_SECTION','Missing '+section['title'],'task-plan.md',f'Section {i}');continue
        if re.sub(r'[^a-z0-9]','',section['title'].lower()) not in re.sub(r'[^a-z0-9]','',s['title'].lower()):add('PLAN_SECTION_TITLE','Use the numbered template section title','task-plan.md',f'Section {i}')
        text=s['text'].strip()
        if len(text)<60 and not re.search(r'(?:N/A|not applicable)[ :–-]+.{25,}',text,re.I):add('PLAN_THIN_SECTION','Section needs concrete details or N/A with a reason','task-plan.md',f'Section {i}')
        if re.search(r'<(?:prompt|path or URL|purpose|local / permitted web / other)>|\b(?:TODO|TBD)\b',text,re.I) or i==3 and re.search(r'<(?:group|candidate|description|conditions|value and unit|details)>',text,re.I):add('PLAN_PLACEHOLDER','Replace unfinished placeholders','task-plan.md',f'Section {i}')
        if re.search(r'^\s*- (?!\[)[^\n]{3,180}:\s*$',text,re.M):add('PLAN_EMPTY_FIELD','Fill the empty template fields, or explain why they do not apply','task-plan.md',f'Section {i}')
    if not re.search(r'Task ID(?: and version)?\s*:\s*`?'+re.escape(task)+r'(?:`|\s|$)',plan,re.I):add('PLAN_TASK_ID','Task ID must match the submission directory','task-plan.md','Section 1')
    declaration={}
    for label,key in [('Source type','type'),('License or permission to redistribute every included file','rights')]:
        m=re.search(r'^\s*-\s*'+re.escape(label)+r':[ \t]*([^\n]+)',body,re.M|re.I);declaration[key]=m[1].strip() if m else ''
    if declaration['type'].lower() not in ['public dataset','published research','own open data','mixed']:add('SOURCE_TYPE','Declare one supported source type in the PR body','PR body','Data-source declaration')
    if len(declaration['rights'])<15 or re.search(r'<|TODO|TBD',declaration['rights'],re.I):add('SOURCE_PERMISSION','Describe the license or permission covering every submitted file','PR body','Data-source declaration')
    if not re.search(r'\[x\]\s+All included material is authorized for public release; no restricted material is attached\.',body,re.I):add('SOURCE_CONFIRMATION','Confirm public redistribution in the PR checklist, or use private submission','PR body','Completeness checklist')
    book=workbook(raw)
    table=book.get('Rankings',[]);guide=book.get('Column guide',[])
    if not table or table[0][0]!=1:raise InspectionError('Rankings sheet must contain machine-readable headers in row 1')
    headers=table[0][1]
    if not all(headers) or len(headers)!=len(set(headers)):raise InspectionError('Rankings headers must be nonempty and unique')
    required=[c['name'] for c in FORMAT['columns']]
    for col in required:
        if col not in headers:add('COLUMN_MISSING','Required template column is missing','reference-rankings.xlsx','Rankings!'+col)
    definitions={};guide_header=None
    for rownum,values in guide:
        if values and values[0].lower()=='column':guide_header=[x.lower() for x in values];continue
        if guide_header and values and values[0]:
            if values[0] in definitions:add('COLUMN_GUIDE_DUPLICATE','Each column must have one unambiguous definition','reference-rankings.xlsx',f'Column guide!row {rownum}')
            definitions[values[0]]={guide_header[i]:value for i,value in enumerate(values) if i<len(guide_header)}
    for col in headers:
        d=definitions.get(col,{});meaning=d.get('meaning and rules','')
        if not d.get('type') or len(meaning)<25:add('COLUMN_UNDOCUMENTED','Define the column type, meaning and interpretation rules','reference-rankings.xlsx','Column guide / '+col)
        elif col not in required and not all(re.search(term,meaning,re.I) for term in ['unit|dimensionless|单位','allowed|enum|permitted|允许','missing|blank|null|缺失']):add('CUSTOM_COLUMN_RULES','Custom columns need units, allowed values and missing-value rules','reference-rankings.xlsx','Column guide / '+col)
    rows=[];keys=set();groups={};required_values=[c['name'] for c in FORMAT['columns'] if c['required']=='Required']
    for rownum,values in table[1:]:
        if not any(values):continue
        if len(rows)>=800:raise InspectionError('Rankings exceeds 800 candidates per submission')
        if len(values)>len(headers):raise InspectionError('Data cells extend beyond the header')
        row={key:values[i] if i<len(values) else '' for i,key in enumerate(headers)};loc=f'Rankings!row {rownum}';row['_row']=rownum;rows.append(row)
        for col in required_values:
            if not row.get(col):add('CELL_REQUIRED','Required value is missing','reference-rankings.xlsx',loc+' / '+col)
        key=(row.get('group_id'),row.get('candidate_id'))
        if key in keys:add('CANDIDATE_DUPLICATE','Candidate ID is repeated within the comparison group','reference-rankings.xlsx',loc+' / candidate_id')
        keys.add(key)
        if row.get('task_id')!=task:add('TASK_ID_MISMATCH','Task ID does not match the submission directory','reference-rankings.xlsx',loc+' / task_id')
        if row.get('direction') not in ('higher_first','lower_first'):add('DIRECTION_INVALID','Use higher_first or lower_first','reference-rankings.xlsx',loc+' / direction')
        relation=row.get('relation_status');rank=num(row.get('rank'))
        if relation not in ('ranked','unknown','excluded'):add('RELATION_INVALID','Use ranked, unknown or excluded','reference-rankings.xlsx',loc+' / relation_status')
        elif relation=='ranked' and (rank is None or rank<1 or not rank.is_integer()):add('RANK_INVALID','Ranked rows require a positive integer rank','reference-rankings.xlsx',loc+' / rank')
        elif relation!='ranked' and row.get('rank'):add('UNKNOWN_HAS_RANK','Unknown/excluded candidates must not have a rank','reference-rankings.xlsx',loc+' / rank')
        if relation in ('unknown','excluded') and not row.get('notes'):add('EXCEPTION_REASON','Explain the unknown relation or exclusion','reference-rankings.xlsx',loc+' / notes')
        for field in ('observed_value','n_replicates'):
            if row.get(field) and (num(row[field]) is None or field=='n_replicates' and (num(row[field])<1 or not num(row[field]).is_integer())):add('NUMBER_INVALID','Use a finite number; replicate counts must be positive integers','reference-rankings.xlsx',loc+' / '+field)
        groups.setdefault(row.get('group_id'),[]).append(row)
    if not rows:add('RANKINGS_EMPTY','Fill Rankings; the Synthetic example sheet is never used as answers','reference-rankings.xlsx','Rankings')
    for group,rs in groups.items():
        loc='Rankings / group '+str(group)[:80]
        for field in ('metric','unit','direction'):
            if len({r.get(field) for r in rs})>1:add('GROUP_INCONSISTENT','Use a consistent '+field+' within a group','reference-rankings.xlsx',loc)
        ranks=[num(r.get('rank')) for r in rs if r.get('relation_status')=='ranked'];valid=[x for x in ranks if x is not None and x>=1 and x.is_integer()]
        unique=sorted(set(valid))
        if unique and (unique[0]!=1 or any(b-a!=1 for a,b in zip(unique,unique[1:]))):add('RANK_NOT_DENSE','Use dense ranks starting at 1 (for example 1, 2, 2, 3)','reference-rankings.xlsx',loc)
        frequencies={}
        for rank in valid:frequencies[rank]=frequencies.get(rank,0)+1
        tied={rank for rank,count in frequencies.items() if count>1}
        if tied and any(not r.get('notes') for r in rs if num(r.get('rank')) in tied):add('TIE_UNEXPLAINED','Document the evidence and criterion for each tied rank','reference-rankings.xlsx',loc)
        ranked=[r for r in rs if r.get('relation_status')=='ranked' and num(r.get('rank')) is not None and num(r.get('observed_value')) is not None]
        ordered=sorted(ranked,key=lambda r:num(r['rank']));direction=rs[0].get('direction')
        tiers={}
        for row in ordered: tiers.setdefault(num(row['rank']),[]).append(num(row['observed_value']))
        ordered_tiers=[tiers[k] for k in sorted(tiers)]
        conflict=any((direction=='higher_first' and min(a)<max(b)) or (direction=='lower_first' and max(a)>min(b)) for a,b in zip(ordered_tiers,ordered_tiers[1:]))
        if conflict:add('RANK_VALUE_CONFLICT','Distinct ranks contradict the stated numeric ordering; explain or correct the reference data','reference-rankings.xlsx',loc)
    # Candidate table is the cross-file identity contract, including unknown/excluded rows.
    declared=set();columns=None
    for line in sections.get(3,{}).get('text','').splitlines():
        if not line.strip().startswith('|'):continue
        values=[v.strip().strip('`') for v in line.strip().strip('|').split('|')]
        if 'group_id' in values and 'candidate_id' in values:columns=values;continue
        if columns and len(values)>=len(columns) and not all(re.fullmatch(r'[:\- ]+',v) for v in values):declared.add((values[columns.index('group_id')],values[columns.index('candidate_id')]))
    if declared!=keys:add('CANDIDATE_COVERAGE','Candidate/group pairs must match exactly between section 3 and Rankings','task-plan.md','Section 3')
    return {'findings':findings,'metrics':{'candidates':len(rows),'groups':len(groups),'columns':len(headers),'sections':len(sections)},'evidence':{'plan':plan,'columns':definitions,'rows':rows,'sourceDeclaration':declaration}}

def main():
    request=json.loads(sys.stdin.buffer.read(1024*1024));base=Path(request['directory']).resolve();task=request['taskId'];body=request.get('body','')
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{2,79}',task):raise InspectionError('Invalid task directory identifier')
    bundle=base/'submission.zip';planfile=base/'task-plan.md';workbookfile=base/'reference-rankings.xlsx'
    if bundle.exists():
        if planfile.exists() or workbookfile.exists():raise InspectionError('Choose unpacked files or submission.zip, not both')
        if bundle.is_symlink() or bundle.stat().st_size>MAX_ZIP:raise InspectionError('Invalid submission ZIP')
        z=archive(bundle.read_bytes());plan=read_member(z,'task-plan.md').decode('utf-8-sig');raw=read_member(z,'reference-rankings.xlsx')
    else:
        for p,limit in [(planfile,128*1024),(workbookfile,MAX_ZIP)]:
            if not p.is_file() or p.is_symlink() or p.stat().st_size>limit:raise InspectionError('Missing, linked or oversized required plan/workbook file')
        plan=planfile.read_text(encoding='utf-8-sig');raw=workbookfile.read_bytes()
    result=inspect(plan,raw,task,body)
    print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':
    try:main()
    except Exception as e:
        # Messages are static parser diagnostics, never raw XML, cell values or exception reprs.
        safe=str(e) if type(e) is InspectionError else 'Unreadable or unsupported input: '+type(e).__name__
        print(json.dumps({'findings':[dict(code='INPUT_UNREADABLE',severity='error',file='submission',location='',message=safe[:240],suggestion='Use the current templates and supported size limits.')],'metrics':{},'evidence':None}))
