import {createHash,randomUUID} from 'node:crypto';
import {requireThat,keys,uuid,integer,text,username} from './errors.js';
export const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
export const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
export const equal=(a,b)=>stable(a)===stable(b);
export const iso=v=>{requireThat(typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v);return v;};
export const after=(at,...sources)=>requireThat(sources.every(x=>Date.parse(at)>=Date.parse(x)),409);
export const find=(rows,id)=>{const r=rows.find(x=>x.id===id);requireThat(r,404);return r;};
const bool=v=>requireThat(typeof v==='boolean');
const code=v=>{requireThat(typeof v==='string'&&/^[A-Z][A-Z0-9_]{0,39}$/.test(v));return v;};
const active=t=>t.sections.filter(x=>!x.archived).sort((a,b)=>a.position-b.position);
function section(s,{complete=false}={}){
 keys(s,['position','titleRu','titleKk','textRu','textKk']);integer(s.position,1,20);
 return {position:s.position,titleRu:text(s.titleRu,200,{empty:!complete}),titleKk:text(s.titleKk,200,{empty:!complete}),textRu:text(s.textRu,5000,{empty:!complete}),textKk:text(s.textKk,5000,{empty:!complete})};
}
export function content(c){keys(c,['title','version','sections']);text(c.title,200);integer(c.version);requireThat(Array.isArray(c.sections)&&c.sections.length>=1&&c.sections.length<=8);let last=0;for(const s of c.sections){section(s,{complete:true});requireThat(s.position>last);last=s.position;}return c;}
export function usedIds(d){return [...d.templates.flatMap(t=>[t.id,...t.sections.map(s=>s.id)]),...d.publications.map(x=>x.id),...d.dispatches.map(x=>x.id),...d.terminals.map(x=>x.id),...d.keys.map(x=>x.key)];}
export function fresh(d,key){uuid(key);requireThat(!usedIds(d).includes(key),409);}
const newId=d=>{let id;do{id=randomUUID();}while(usedIds(d).includes(id));return id;};
export function visible(d,id,name){const row=d.dispatches.find(x=>x.id===id&&x.recipient===name&&x.state!=='withdrawn');requireThat(row,404);return row;}
export function project(d,row){
 const terminal=d.terminals.find(x=>x.dispatchId===row.id&&x.kind==='acknowledged');
 return {id:row.id,version:row.version,state:row.state,language:row.language,issuedAt:row.issuedAt,content:{title:row.snapshot.title,version:row.snapshot.version,sections:row.snapshot.sections.map(s=>({position:s.position,titleRu:s.titleRu,titleKk:s.titleKk,textRu:s.textRu,textKk:s.textKk}))},acknowledgement:terminal?{note:terminal.note,at:terminal.at}:null};
}
export const ACTION_FIELDS={
 'template.create':['code','title'],'template.edit':['templateId','title'],'template.archive':['templateId'],
 'section.save':['templateId','sectionId','position','titleRu','titleKk','textRu','textKk'],'section.archive':['templateId','sectionId'],
 publish:['templateId'],'publication.archive':['publicationId'],dispatch:['publicationId','recipient','language'],withdraw:['dispatchUUID','expectedVersion','note'],'dispatch.archive':['dispatchUUID']
};
export function commandShape(c){requireThat(c&&typeof c==='object'&&Object.hasOwn(ACTION_FIELDS,c.action));keys(c,['action','revision','requestKey',...ACTION_FIELDS[c.action]]);integer(c.revision,0);uuid(c.requestKey);}
export function applyAdmin(d,c,actor,at,roleFor){
 const template=()=>find(d.templates,uuid(c.templateId));
 switch(c.action){
 case 'template.create':{
  const rowCode=code(c.code),title=text(c.title,200);requireThat(!d.templates.some(x=>x.code===rowCode),409);
  d.templates.push({id:newId(d),code:rowCode,title,version:1,archived:false,createdBy:actor.name,createdAt:at,updatedAt:at,sections:[],requestKey:c.requestKey});return true;
 }
 case 'template.edit':{
  const t=template(),title=text(c.title,200);requireThat(!t.archived,409);if(t.title===title)return false;after(at,t.updatedAt);t.title=title;t.version++;t.updatedAt=at;return true;
 }
 case 'template.archive':{const t=template();requireThat(!t.archived,409);after(at,t.updatedAt);t.archived=true;t.updatedAt=at;return true;}
 case 'section.save':{
  const t=template();requireThat(!t.archived,409);const s=section({position:c.position,titleRu:c.titleRu,titleKk:c.titleKk,textRu:c.textRu,textKk:c.textKk});
  requireThat(c.sectionId===null||typeof c.sectionId==='string');const current=c.sectionId===null?null:find(t.sections,uuid(c.sectionId));requireThat(!current?.archived,409);
  requireThat(!active(t).some(x=>x.position===s.position&&x.id!==current?.id));if(!current)requireThat(active(t).length<8);
  if(current&&equal(section({position:current.position,titleRu:current.titleRu,titleKk:current.titleKk,textRu:current.textRu,textKk:current.textKk}),s))return false;
  after(at,t.updatedAt);if(current)Object.assign(current,s);else t.sections.push({id:newId(d),...s,archived:false});t.version++;t.updatedAt=at;return true;
 }
 case 'section.archive':{const t=template(),s=find(t.sections,uuid(c.sectionId));requireThat(!t.archived&&!s.archived,409);after(at,t.updatedAt);s.archived=true;t.version++;t.updatedAt=at;return true;}
 case 'publish':{
  const t=template();requireThat(!t.archived,409);requireThat(!d.publications.some(x=>x.templateId===t.id&&x.content.version===t.version),409);
  const snapshot=content({title:t.title,version:t.version,sections:active(t).map(s=>section({position:s.position,titleRu:s.titleRu,titleKk:s.titleKk,textRu:s.textRu,textKk:s.textKk},{complete:true}))});after(at,t.updatedAt);
  d.publications.push({id:newId(d),templateId:t.id,content:snapshot,digest:hash(snapshot),author:actor.name,at,archived:false,requestKey:c.requestKey});return true;
 }
 case 'publication.archive':{const p=find(d.publications,uuid(c.publicationId));requireThat(!p.archived,409);after(at,p.at);p.archived=true;return true;}
 case 'dispatch':{
  const p=find(d.publications,uuid(c.publicationId)),t=find(d.templates,p.templateId),recipient=username(c.recipient);requireThat(!p.archived&&!t.archived,409);requireThat(['ru','kk'].includes(c.language));requireThat(recipient!==actor.name&&roleFor(recipient)==='operator');
  requireThat(!d.dispatches.some(x=>x.publicationId===p.id&&x.recipient===recipient),409);after(at,p.at);
  d.dispatches.push({id:newId(d),publicationId:p.id,recipient,language:c.language,issuedBy:actor.name,issuedAt:at,snapshot:structuredClone(p.content),digest:p.digest,version:1,state:'available',adminArchived:false,requestKey:c.requestKey});return true;
 }
 case 'withdraw':{
  const r=find(d.dispatches,uuid(c.dispatchUUID));integer(c.expectedVersion);const note=text(c.note,2000);requireThat(r.state==='available'&&r.version===c.expectedVersion,409);after(at,r.issuedAt);
  d.terminals.push({id:newId(d),dispatchId:r.id,kind:'withdrawn',actor:actor.name,at,note,contentDigest:r.digest,requestKey:c.requestKey});r.state='withdrawn';r.version=2;return true;
 }
 case 'dispatch.archive':{const r=find(d.dispatches,uuid(c.dispatchUUID));requireThat(r.state!=='available'&&!r.adminArchived,409);const terminal=d.terminals.find(x=>x.dispatchId===r.id);after(at,terminal.at);r.adminArchived=true;return true;}
 }
}
export function ackShape(input,preview=false){keys(input,preview?['dispatchUUID','expectedVersion']:['dispatchUUID','expectedVersion','requestKey','note']);uuid(input.dispatchUUID);integer(input.expectedVersion);if(!preview){uuid(input.requestKey);text(input.note,2000);}}
export function applyAck(d,input,actor,at){
 const row=visible(d,input.dispatchUUID,actor.name);requireThat(row.state==='available'&&row.version===input.expectedVersion,409);fresh(d,input.requestKey);after(at,row.issuedAt);
 d.terminals.push({id:newId(d),dispatchId:row.id,kind:'acknowledged',actor:actor.name,at,note:text(input.note,2000),contentDigest:row.digest,requestKey:input.requestKey});row.state='acknowledged';row.version=2;return {packet:project(d,row)};
}
export function validateData(d,roleFor,now){
 keys(d,['templates','publications','dispatches','terminals','keys']);for(const list of Object.values(d))requireThat(Array.isArray(list)&&list.length<=100000);
 const ids=usedIds(d);requireThat(ids.every(x=>typeof x==='string')&&new Set(ids).size===ids.length);for(const id of ids)uuid(id);
 const requireRole=(name,role)=>{username(name);requireThat(roleFor(name)===role);};
 const checkTime=at=>{iso(at);requireThat(Date.parse(at)<=Date.parse(now));};
 const boundKeys=new Set();
 const keyFor=(row,action,actor,at)=>{const key=d.keys.find(x=>x.key===row.requestKey);requireThat(key&&key.action===action&&key.actor===actor&&key.at===at&&!boundKeys.has(row.requestKey));boundKeys.add(row.requestKey);};
 const unique=(list,key)=>requireThat(new Set(list.map(key)).size===list.length);
 unique(d.templates,x=>x.code);
 for(const k of d.keys){keys(k,['key','at','actor','action']);uuid(k.key);checkTime(k.at);requireThat(Object.hasOwn(ACTION_FIELDS,k.action)||['acknowledge','restore'].includes(k.action));requireRole(k.actor,k.action==='acknowledge'?'operator':'admin');}
 for(const t of d.templates){
  keys(t,['id','code','title','version','archived','createdBy','createdAt','updatedAt','sections','requestKey']);code(t.code);requireThat(text(t.title,200)===t.title);integer(t.version);bool(t.archived);requireRole(t.createdBy,'admin');checkTime(t.createdAt);checkTime(t.updatedAt);requireThat(Date.parse(t.updatedAt)>=Date.parse(t.createdAt));keyFor(t,'template.create',t.createdBy,t.createdAt);requireThat(Array.isArray(t.sections));
  const a=active(t);requireThat(a.length<=8);unique(a,x=>x.position);
  for(const s of t.sections){keys(s,['id','position','titleRu','titleKk','textRu','textKk','archived']);bool(s.archived);const clean=section({position:s.position,titleRu:s.titleRu,titleKk:s.titleKk,textRu:s.textRu,textKk:s.textKk});for(const [k,v]of Object.entries(clean))requireThat(s[k]===v);}
 }
 unique(d.publications,p=>p.templateId+':'+p.content.version);
 for(const p of d.publications){keys(p,['id','templateId','content','digest','author','at','archived','requestKey']);const t=find(d.templates,uuid(p.templateId));content(p.content);requireThat(p.content.version<=t.version&&p.digest===hash(p.content));requireRole(p.author,'admin');checkTime(p.at);requireThat(Date.parse(p.at)>=Date.parse(t.createdAt));bool(p.archived);keyFor(p,'publish',p.author,p.at);}
 unique(d.dispatches,r=>r.publicationId+':'+r.recipient);
 for(const r of d.dispatches){
  keys(r,['id','publicationId','recipient','language','issuedBy','issuedAt','snapshot','digest','version','state','adminArchived','requestKey']);const p=find(d.publications,uuid(r.publicationId));requireRole(r.recipient,'operator');requireRole(r.issuedBy,'admin');requireThat(r.recipient!==r.issuedBy&&['ru','kk'].includes(r.language));checkTime(r.issuedAt);requireThat(Date.parse(r.issuedAt)>=Date.parse(p.at));requireThat(equal(r.snapshot,p.content)&&r.digest===p.digest);bool(r.adminArchived);keyFor(r,'dispatch',r.issuedBy,r.issuedAt);
  requireThat(['available','acknowledged','withdrawn'].includes(r.state)&&r.version===(r.state==='available'?1:2));const ts=d.terminals.filter(x=>x.dispatchId===r.id);requireThat(ts.length===(r.state==='available'?0:1));if(r.state==='available')requireThat(!r.adminArchived);else requireThat(ts[0].kind===r.state);
 }
 unique(d.terminals,t=>t.dispatchId);
 for(const t of d.terminals){keys(t,['id','dispatchId','kind','actor','at','note','contentDigest','requestKey']);const r=find(d.dispatches,uuid(t.dispatchId));requireThat(['acknowledged','withdrawn'].includes(t.kind));requireRole(t.actor,t.kind==='acknowledged'?'operator':'admin');requireThat(t.actor===(t.kind==='acknowledged'?r.recipient:t.actor));requireThat(text(t.note,2000)===t.note);checkTime(t.at);requireThat(Date.parse(t.at)>=Date.parse(r.issuedAt)&&t.contentDigest===r.digest);keyFor(t,t.kind==='acknowledged'?'acknowledge':'withdraw',t.actor,t.at);}
 return d;
}
