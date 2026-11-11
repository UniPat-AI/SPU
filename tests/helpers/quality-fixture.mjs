import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
const format=JSON.parse(await fs.readFile(new URL('../../shared/submission-format.json',import.meta.url),'utf8'));
export const declaration='- Source type: own open data\n- License or permission to redistribute every included file: Original synthetic fixture, released by its author for unrestricted redistribution.\n- [x] All included material is authorized for public release; no restricted material is attached.\n';
export function records(task='synthetic-quality') {return ['A','B'].map((id,i)=>({task_id:task,group_id:'group1',candidate_id:id,candidate_description:'Synthetic condition '+id,metric:'Synthetic assay outcome',unit:'dimensionless',direction:'higher_first',rank:String(i+1),relation_status:'ranked',observed_value:String(2-i),n_replicates:'3',uncertainty:'SD 0.1 dimensionless; three independent replicates',evidence_ref:'synthetic-results.csv row '+(i+2),notes:'Entirely synthetic software-test fixture.'}))}
export async function qualityFixture(root,options={}){
 const task=options.task||'synthetic-quality',directory=path.join(root,task);await fs.mkdir(directory,{recursive:true});
 const rows=options.rows||records(task),headers=options.headers||format.columns.map(c=>c.name);
 const sections=format.sections.map((s,i)=>`## ${i+1}. ${s.title}\n\n`+(i===0?`- Task ID and version: ${task} v1\n`:i===2?'| group_id | candidate_id | Description |\n| --- | --- | --- |\n| group1 | A | Synthetic candidate A |\n| group1 | B | Synthetic candidate B |\n':'')+`This is an explicitly synthetic test fixture. The protocol uses three independent observations under identical controlled conditions. Details, units, exclusions and evidence are documented solely for testing the quality checker, not scientific validation.\n`);
 const plan=options.plan??'# Synthetic quality test\n\n'+sections.join('\n');
 await fs.writeFile(path.join(directory,'task-plan.md'),plan);
 const guide=options.guide??format.columns.map(c=>[c.name,c.type,c.required,c.description,c.example]);
 const result=spawnSync('python3',['-I','-c',`import sys,json,zipfile,xml.etree.ElementTree as E
from pathlib import Path
q=json.load(sys.stdin);ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
def sheet(rows):
 root=E.Element('worksheet',xmlns=ns);data=E.SubElement(root,'sheetData')
 for i,values in enumerate(rows,1):
  row=E.SubElement(data,'row',r=str(i))
  for j,value in enumerate(values,1):
   n=j;col=''
   while n:n,k=divmod(n-1,26);col=chr(65+k)+col
   c=E.SubElement(row,'c',r=col+str(i),t='inlineStr');s=E.SubElement(c,'is');E.SubElement(s,'t').text=str(value)
   if q.get('formula') and i==2 and j==8:E.SubElement(c,'f').text='1+1'
 return E.tostring(root)
with zipfile.ZipFile(q['file'],'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('xl/workbook.xml','<workbook xmlns="'+ns+'" xmlns:r="'+rel+'"><sheets><sheet name="Rankings" sheetId="1" r:id="r1"/><sheet name="Column guide" sheetId="2" r:id="r2"/></sheets></workbook>')
 z.writestr('xl/_rels/workbook.xml.rels',('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="worksheets/sheet2.xml"/></Relationships>').replace('Id="r1"','Id="r1" TargetMode="External"' if q.get('external') else 'Id="r1"'))
 z.writestr('xl/worksheets/sheet1.xml',b'<!DOCTYPE worksheet [<!ENTITY e "blocked">]><worksheet>&e;</worksheet>' if q.get('entity') else sheet([q['headers']]+[[r.get(c,'') for c in q['headers']] for r in q['rows']]))
 z.writestr('xl/worksheets/sheet2.xml',sheet([['Column','Type','Required','Meaning and rules','Example']]+q['guide']))
 if q.get('macro'):z.writestr('xl/vbaProject.bin',b'fake macro')
 if q.get('bomb'):z.writestr('large.txt',b'x'*1000000)
 if q.get('unsafe'):z.writestr('../outside.txt',b'not extracted')
 if q.get('duplicate'):z.writestr('xl/worksheets/sheet1.xml',b'fake duplicate')
 if q.get('symlink'):
  link=zipfile.ZipInfo('linked-file');link.create_system=3;link.external_attr=0o120777<<16;z.writestr(link,b'/etc/passwd')
`],{input:JSON.stringify({file:path.join(directory,'reference-rankings.xlsx'),headers,rows,guide,...options}),encoding:'utf8',env:{PATH:process.env.PATH},maxBuffer:1024*1024});
 if(result.status!==0)throw new Error('Fixture workbook generation failed: '+result.stderr);
 return {directory,task,body:options.body??declaration};
}
