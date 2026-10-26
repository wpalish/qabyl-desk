import test from 'node:test';
import assert from 'node:assert/strict';
import {PacketStore} from '../core/store.js';

test('new store has empty domain and no phantom publication or recipient packet',()=>{
 const s=new PacketStore();
 try{assert.deepEqual(s.snapshot(),{revision:0,data:{templates:[],publications:[],dispatches:[],terminals:[],keys:[]}});assert.equal(s.db.prepare('SELECT count(*) n FROM audit').get().n,0);}finally{s.close();}
});

import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const admin={name:'admin_qa',role:'admin'},alpha={name:'alpha_qa',role:'operator'},beta={name:'beta_qa',role:'operator'};
const at=Date.parse('2026-10-26T09:00:00.000Z');
function setup(t,path=':memory:'){
 let clock=at;const s=new PacketStore(path,{now:()=>clock});
 for(const u of [admin,alpha,beta])s.db.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?)').run(u.name,'fixture-not-login-password',u.role);
 t.after(()=>s.close());return {s,setTime:x=>clock=x};
}
const cmd=(s,action,fields={},actor=admin)=>s.admin({action,revision:s.snapshot().revision,requestKey:randomUUID(),...fields},actor);
function prepared(s,{sections=1}={}){
 cmd(s,'template.create',{code:'SYN_START',title:'Вымышленный пакет'});const templateId=s.snapshot().data.templates[0].id;
 for(let i=1;i<=sections;i++)cmd(s,'section.save',{templateId,sectionId:null,position:i,titleRu:'Раздел '+i,titleKk:'Бөлім '+i,textRu:'Только вымышленный текст '+i,textKk:'Тек ойдан шығарылған мәтін '+i});
 cmd(s,'publish',{templateId});return {templateId,publicationId:s.snapshot().data.publications[0].id};
}
function issued(s,recipient=alpha.name){const p=prepared(s);cmd(s,'dispatch',{publicationId:p.publicationId,recipient,language:'kk'});return {...p,id:s.snapshot().data.dispatches[0].id};}
const ack=(s,id,actor=alpha,extra={})=>s.acknowledge({dispatchUUID:id,expectedVersion:1,requestKey:randomUUID(),note:'Ручная отметка вымышленного аккаунта',...extra},actor);
function unchanged(s,fn,status){const before=s.snapshot(),audit=s.db.prepare('SELECT * FROM audit ORDER BY seq').all();assert.throws(fn,e=>e.status===status);assert.deepEqual(s.snapshot(),before);assert.deepEqual(s.db.prepare('SELECT * FROM audit ORDER BY seq').all(),audit);}

test('publication requires complete bilingual sections and freezes exact ordered content',t=>{
 const {s}=setup(t);cmd(s,'template.create',{code:'SYN_EMPTY',title:'Черновик'});const id=s.snapshot().data.templates[0].id;unchanged(s,()=>cmd(s,'publish',{templateId:id}),400);
 cmd(s,'section.save',{templateId:id,sectionId:null,position:20,titleRu:'Русский',titleKk:'',textRu:'Текст',textKk:''});unchanged(s,()=>cmd(s,'publish',{templateId:id}),400);
 const sec=s.snapshot().data.templates[0].sections[0];cmd(s,'section.save',{templateId:id,sectionId:sec.id,position:20,titleRu:'Русский',titleKk:'Қазақша',textRu:'Текст',textKk:'Мәтін'});cmd(s,'publish',{templateId:id});
 const pub=s.snapshot().data.publications[0];assert.deepEqual(pub.content,{title:'Черновик',version:3,sections:[{position:20,titleRu:'Русский',titleKk:'Қазақша',textRu:'Текст',textKk:'Мәтін'}]});assert.match(pub.digest,/^[0-9a-f]{64}$/);
});
test('meaningful draft edit advances version but no-op does not consume key or audit',t=>{
 const {s}=setup(t);const {templateId}=prepared(s),before=s.snapshot(),aud=s.db.prepare('SELECT * FROM audit').all();cmd(s,'template.edit',{templateId,title:'Вымышленный пакет'});assert.deepEqual(s.snapshot(),before);assert.deepEqual(s.db.prepare('SELECT * FROM audit').all(),aud);
 cmd(s,'template.edit',{templateId,title:'Новый черновик'});assert.equal(s.snapshot().data.templates[0].version,3);assert.equal(s.snapshot().data.publications[0].content.title,'Вымышленный пакет');
});
test('canonical field types, UTF16 bounds, active section count and distinct order enforced',t=>{
 const {s}=setup(t);cmd(s,'template.create',{code:'SYN_BOUND',title:'A'});const id=s.snapshot().data.templates[0].id;
 const section={templateId:id,sectionId:null,position:1,titleRu:'A',titleKk:'Ә',textRu:'🧪'.repeat(2500),textKk:'Ә'.repeat(5000)};cmd(s,'section.save',section);
 for(const bad of [{...section,position:'2'},{...section,position:2,textRu:'🧪'.repeat(2501)},{...section,position:2,titleKk:7},{...section,position:1}])unchanged(s,()=>cmd(s,'section.save',bad),400);
 for(let i=2;i<=8;i++)cmd(s,'section.save',{...section,position:i,textRu:'A'});unchanged(s,()=>cmd(s,'section.save',{...section,position:9}),400);cmd(s,'publish',{templateId:id});
});
test('published version cannot be published twice even after archive; section archive increments draft',t=>{
 const {s}=setup(t);const {templateId,publicationId}=prepared(s);cmd(s,'publication.archive',{publicationId});unchanged(s,()=>cmd(s,'publish',{templateId}),409);
 const sectionId=s.snapshot().data.templates[0].sections[0].id;cmd(s,'section.archive',{templateId,sectionId});assert.equal(s.snapshot().data.templates[0].version,3);unchanged(s,()=>cmd(s,'publish',{templateId}),400);
});
test('dispatch requires current operator, rejects self/admin/absent and is permanently unique per publication recipient',t=>{
 const {s}=setup(t);const {publicationId}=prepared(s);
 for(const recipient of [admin.name,'missing_qa'])unchanged(s,()=>cmd(s,'dispatch',{publicationId,recipient,language:'ru'}),400);
 cmd(s,'dispatch',{publicationId,recipient:alpha.name,language:'ru'});const d=s.snapshot().data.dispatches[0];cmd(s,'withdraw',{dispatchUUID:d.id,expectedVersion:1,note:'Явный отзыв синтетического пакета'});
 unchanged(s,()=>cmd(s,'dispatch',{publicationId,recipient:alpha.name,language:'kk'}),409);cmd(s,'dispatch',{publicationId,recipient:beta.name,language:'kk'});assert.equal(s.snapshot().data.dispatches.length,2);
});
test('recipient DTO recursively contains only owned packet fields and never master metadata',t=>{
 const {s}=setup(t);const {publicationId,id}=issued(s);cmd(s,'dispatch',{publicationId,recipient:beta.name,language:'ru'});
 const a=s.recipientState(alpha),b=s.recipientState(beta);assert.equal(a.packets.length,1);assert.equal(b.packets.length,1);assert.notEqual(a.packets[0].id,b.packets[0].id);
 assert.deepEqual(a.packets[0],{id,version:1,state:'available',language:'kk',issuedAt:'2026-10-26T09:00:00.000Z',content:{title:'Вымышленный пакет',version:2,sections:[{position:1,titleRu:'Раздел 1',titleKk:'Бөлім 1',textRu:'Только вымышленный текст 1',textKk:'Тек ойдан шығарылған мәтін 1'}]},acknowledgement:null});
 for(const forbidden of ['publicationId','templateId','requestKey','revision','recipient','actor','audit','keys','adminRationale'])assert.equal(JSON.stringify(a).includes('"'+forbidden+'"'),false,forbidden);
});
test('known foreign, unknown and withdrawn target have same404 before version and global-key checks',t=>{
 const {s}=setup(t);const {id,publicationId}=issued(s);cmd(s,'dispatch',{publicationId,recipient:beta.name,language:'ru'});const foreign=s.snapshot().data.dispatches[1].id;
 cmd(s,'withdraw',{dispatchUUID:id,expectedVersion:1,note:'Отзыв'});const reused=s.snapshot().data.keys[0].key;
 for(const target of [id,foreign,randomUUID()]){
  unchanged(s,()=>s.packet(target,alpha),404);unchanged(s,()=>s.preview({dispatchUUID:target,expectedVersion:999},alpha),404);unchanged(s,()=>ack(s,target,alpha,{expectedVersion:999,requestKey:reused}),404);
 }
});
test('only bound current operator can acknowledge and no client author/content fields accepted',t=>{
 const {s}=setup(t);const {id}=issued(s);unchanged(s,()=>ack(s,id,admin),403);unchanged(s,()=>ack(s,id,beta),404);unchanged(s,()=>ack(s,id,alpha,{actor:beta.name}),400);
 s.db.prepare('UPDATE users SET role=? WHERE name=?').run('admin',alpha.name);unchanged(s,()=>ack(s,id,alpha),403);
});
test('explicit acknowledgement freezes note and returns the exact GET projection once',t=>{
 const {s}=setup(t);const {id}=issued(s),before=s.snapshot(),preview=s.preview({dispatchUUID:id,expectedVersion:1},alpha);assert.equal(preview.canAcknowledge,true);assert.deepEqual(s.snapshot(),before);
 const out=ack(s,id,alpha,{note:'  {"x":"<script>"}  '});assert.deepEqual(out,s.packet(id,alpha));assert.equal(out.packet.state,'acknowledged');assert.equal(out.packet.version,2);assert.deepEqual(out.packet.acknowledgement,{note:'{"x":"<script>"}',at:'2026-10-26T09:00:00.000Z'});assert.equal(s.snapshot().data.terminals.length,1);
 unchanged(s,()=>ack(s,id),409);unchanged(s,()=>cmd(s,'withdraw',{dispatchUUID:id,expectedVersion:2,note:'Поздний отзыв'}),409);
});
test('objectCAS ignores unrelated global revision; stale own version and reused key preserve all state/audit',t=>{
 const {s}=setup(t);const {id}=issued(s),packet=s.packet(id,alpha).packet;
 cmd(s,'template.create',{code:'OTHER_DRAFT',title:'Несвязанный черновик'});unchanged(s,()=>ack(s,id,alpha,{expectedVersion:2}),409);unchanged(s,()=>ack(s,id,alpha,{requestKey:s.snapshot().data.keys[0].key}),409);
 assert.equal(ack(s,id,alpha,{expectedVersion:packet.version}).packet.state,'acknowledged');
});
test('archive closes new dispatches but old frozen packet and acknowledged history remain available',t=>{
 const {s}=setup(t);const {id,templateId,publicationId}=issued(s),frozen=s.packet(id,alpha).packet.content;
 cmd(s,'template.edit',{templateId,title:'Changed'});cmd(s,'publication.archive',{publicationId});cmd(s,'template.archive',{templateId});unchanged(s,()=>cmd(s,'dispatch',{publicationId,recipient:beta.name,language:'ru'}),409);
 ack(s,id);cmd(s,'dispatch.archive',{dispatchUUID:id});assert.deepEqual(s.packet(id,alpha).packet.content,frozen);assert.equal(s.recipientState(alpha).packets.length,1);
});
test('source dispatch and terminal clock rollback fail without mutation; reads and preview never write',t=>{
 const {s,setTime}=setup(t);const {publicationId}=prepared(s);setTime(at-1);unchanged(s,()=>cmd(s,'dispatch',{publicationId,recipient:alpha.name,language:'ru'}),409);setTime(at);cmd(s,'dispatch',{publicationId,recipient:alpha.name,language:'ru'});const id=s.snapshot().data.dispatches[0].id;
 setTime(at-1);unchanged(s,()=>ack(s,id),409);setTime(at+1000);const before=s.snapshot(),audit=s.db.prepare('SELECT * FROM audit').all();s.recipientState(alpha);s.packet(id,alpha);s.preview({dispatchUUID:id,expectedVersion:1},alpha);assert.deepEqual(s.snapshot(),before);assert.deepEqual(s.db.prepare('SELECT * FROM audit').all(),audit);
});
test('strict acknowledgement envelope rejects coercion uppercase IDs missing/unknown keys and oversized note',t=>{
 const {s}=setup(t);const {id}=issued(s);for(const extra of [{expectedVersion:'1'},{expectedVersion:true},{expectedVersion:1.5},{requestKey:randomUUID().toUpperCase()},{dispatchUUID:id.toUpperCase()},{note:''},{note:3},{note:'x'.repeat(2001)},{recipient:alpha.name}])unchanged(s,()=>ack(s,id,alpha,extra),400);
 unchanged(s,()=>s.acknowledge({dispatchUUID:id,expectedVersion:1,requestKey:randomUUID()},alpha),400);
});
test('two SQLite connections resolve ack versus withdraw to one terminal transition',t=>{
 const dir=mkdtempSync(join(tmpdir(),'qabyl-race-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'test.sqlite'),{s}=setup(t,path),{id}=issued(s),other=new PacketStore(path,{now:()=>at});t.after(()=>other.close());
 const oldRevision=other.snapshot().revision;ack(s,id);unchanged(other,()=>other.admin({action:'withdraw',revision:oldRevision,requestKey:randomUUID(),dispatchUUID:id,expectedVersion:1,note:'Другой исход'},admin),409);assert.equal(other.snapshot().data.terminals.length,1);
});
test('global key collision across two different dispatches commits only one; withdrawn cannot be acknowledged',t=>{
 const {s}=setup(t);const {id,publicationId}=issued(s);cmd(s,'dispatch',{publicationId,recipient:beta.name,language:'ru'});const b=s.snapshot().data.dispatches[1].id,key=randomUUID();ack(s,id,alpha,{requestKey:key});unchanged(s,()=>ack(s,b,beta,{requestKey:key}),409);
 cmd(s,'withdraw',{dispatchUUID:b,expectedVersion:1,note:'Неотмеченный пакет отозван'});unchanged(s,()=>ack(s,b,beta),404);assert.equal(s.recipientState(beta).packets.length,0);assert.equal(s.snapshot().data.terminals.length,2);
});
test('JSON backup empty restore preserves recipient access and rejects corrupt copies atomically',t=>{
 const {s}=setup(t);const {id}=issued(s);ack(s,id);const backup=s.backup(admin);assert.deepEqual(Object.keys(backup).sort(),['data','format']);for(const k of ['users','sessions','audit','password'])assert.equal(Object.keys(backup.data).includes(k),false);
 const target=setup(t).s;target.restore({backup,revision:0,requestKey:randomUUID()},admin);assert.deepEqual(target.recipientState(alpha),s.recipientState(alpha));unchanged(target,()=>target.restore({backup,revision:target.snapshot().revision,requestKey:randomUUID()},admin),409);
 const corruptions=[x=>x.data.dispatches[0].recipient='missing_qa',x=>x.data.dispatches[0].snapshot.title='wrong',x=>x.data.publications[0].digest='0'.repeat(64),x=>x.data.dispatches[0].version=1,x=>x.data.terminals=[],x=>x.data.terminals.push(structuredClone(x.data.terminals[0])),x=>x.data.keys=[],x=>x.data.terminals[0].at='2026-10-25T00:00:00.000Z',x=>x.data.dispatches.push(structuredClone(x.data.dispatches[0]))];
 for(const corrupt of corruptions){const b=structuredClone(backup);corrupt(b);const fresh=setup(t).s;unchanged(fresh,()=>fresh.restore({backup:b,revision:0,requestKey:randomUUID()},admin),400);}
});
test('consistent full SQLite file backup and restart preserve domain audit all5tables and scoped reads',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'qabyl-file-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'source.sqlite'),{s}=setup(t,path),{id}=issued(s);ack(s,id);s.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run('fixturehash',alpha.name,'fixturecsrf',at+100000);s.db.prepare('INSERT INTO failures VALUES(?,?,?)').run('fixture',2,at);
 const file=join(dir,'consistent.sqlite');await s.backupFile(file);const restored=new PacketStore(file,{now:()=>at});t.after(()=>restored.close());assert.deepEqual(restored.snapshot(),s.snapshot());assert.deepEqual(restored.recipientState(alpha),s.recipientState(alpha));
 for(const table of ['workspace','audit','users','sessions','failures'])assert.deepEqual(restored.db.prepare('SELECT * FROM '+table).all(),s.db.prepare('SELECT * FROM '+table).all());
 const restarted=new PacketStore(path,{now:()=>at});t.after(()=>restarted.close());assert.deepEqual(restarted.snapshot(),s.snapshot());assert.deepEqual(restarted.recipientState(alpha),s.recipientState(alpha));
});

test('restore binds immutable rows to exact original request-key actor/time and rejects missing typed lists',t=>{
 const {s}=setup(t);const {id}=issued(s);ack(s,id);const backup=s.backup(admin);
 for(const change of [b=>b.data.keys.find(k=>k.action==='acknowledge').actor=beta.name,b=>b.data.keys.find(k=>k.action==='dispatch').at='2026-10-25T00:00:00.000Z',b=>b.data.publications[0].templateId=randomUUID(),b=>b.data.templates=null]){
  const b=structuredClone(backup);change(b);const fresh=setup(t).s;unchanged(fresh,()=>fresh.restore({backup:b,revision:0,requestKey:randomUUID()},admin),400);
 }
});

test('two independent SQLite connections share global keys across otherwise unrelated recipient objectCAS writes',t=>{
 const dir=mkdtempSync(join(tmpdir(),'qabyl-global-key-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'test.sqlite'),{s}=setup(t,path),{id,publicationId}=issued(s);cmd(s,'dispatch',{publicationId,recipient:beta.name,language:'ru'});const b=s.snapshot().data.dispatches[1].id,other=new PacketStore(path,{now:()=>at});t.after(()=>other.close());const key=randomUUID();
 ack(s,id,alpha,{requestKey:key});unchanged(other,()=>ack(other,b,beta,{requestKey:key}),409);assert.equal(other.packet(b,beta).packet.version,1);assert.equal(other.snapshot().data.terminals.length,1);
});

test('restore rejects one request-key reused by two immutable rows even with matching action actor and timestamp',t=>{
 const {s}=setup(t),{publicationId}=prepared(s);cmd(s,'template.create',{code:'SYN_SECOND',title:'Второй пакет'});const templateId=s.snapshot().data.templates[1].id;cmd(s,'section.save',{templateId,sectionId:null,position:1,titleRu:'Раздел',titleKk:'Бөлім',textRu:'Вымышленный текст',textKk:'Ойдан шығарылған мәтін'});cmd(s,'publish',{templateId});
 for(const recipient of[alpha.name,beta.name])cmd(s,'dispatch',{publicationId,recipient,language:'ru'});for(const row of s.snapshot().data.dispatches)cmd(s,'withdraw',{dispatchUUID:row.id,expectedVersion:1,note:'Синтетический отзыв'});
 const backup=s.backup(admin),valid=setup(t).s;valid.restore({backup,revision:0,requestKey:randomUUID()},admin);assert.deepEqual(valid.snapshot().data.dispatches,s.snapshot().data.dispatches);
 for(const list of['templates','publications','dispatches','terminals']){const corrupt=structuredClone(backup);corrupt.data[list][1].requestKey=corrupt.data[list][0].requestKey;const target=setup(t).s;unchanged(target,()=>target.restore({backup:corrupt,revision:0,requestKey:randomUUID()},admin),400);}
});
