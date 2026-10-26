import test from 'node:test';
import assert from 'node:assert/strict';
import {createCabinet,publicationPreviewFor,adminDispatchRows} from '../public/client.js';
const alpha={name:'alpha_qa',role:'operator',csrf:'synthetic-alpha-csrf'},beta={name:'beta_qa',role:'operator',csrf:'synthetic-beta-csrf'};
const A={id:'11111111-1111-4111-8111-111111111111',version:1,state:'available',language:'kk',issuedAt:'2026-10-26T09:00:00.000Z',content:{title:'SyntheticA',version:4,sections:[{position:1,titleRu:'Текст',titleKk:'Мәтін',textRu:'ВымышленныйA',textKk:'ОйданA'}]},acknowledgement:null};
const B={...A,id:'22222222-2222-4222-8222-222222222222',content:{...A.content,title:'SyntheticB'}};
const failure=status=>Object.assign(new Error('Fixedpublicmessage'),{status});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(){
 let user=alpha,withdrawn=false,acked=null,lateState=null,lateAck=null,lost=false;const calls=[];
 const transport=async(path,options={})=>{
  calls.push({path,options});if(path==='/api/session')return {user};if(path==='/api/login'){user=options.body.username==='beta_qa'?beta:alpha;return {user};}if(path==='/api/logout')return {loggedOut:true};
  const packet=user.name===alpha.name?A:B;
  const current=()=>({...structuredClone(packet),...(acked===packet.id?{version:2,state:'acknowledged',acknowledgement:{note:'Синтетическая отметка',at:'2026-10-26T09:00:01.000Z'}}:{})});
  if(path==='/api/state'){if(lateState){const d=lateState;lateState=null;return d.promise;}return {packets:withdrawn?[]:[current()]};}
  if(path.startsWith('/api/dispatch/')){if(withdrawn||!path.endsWith(packet.id))throw failure(404);return {packet:current()};}
  if(path==='/api/ack-preview'){if(withdrawn)throw failure(404);return {packet:current(),canAcknowledge:true};}
  if(path==='/api/acknowledge'){if(withdrawn)throw failure(404);acked=packet.id;if(lateAck){const d=lateAck;lateAck=null;const frozen=current();await d.promise;return {packet:frozen};}if(lost)throw new TypeError('Synthetic connection lost after commit');return {packet:current()};}
  throw Error('Unexpectedpath');
 };
 const c=createCabinet(transport);return {c,calls,setUser:u=>user=u,setWithdrawn:v=>withdrawn=v,setLateState:d=>lateState=d,setLost:v=>lost=v,setLateAck:d=>lateAck=d};
}

test('same-account refresh retains unsaved note;withdraw hides content and retains only separate note copy',async()=>{
 const {c,setWithdrawn}=harness();await c.refresh();await c.select(A.id);c.setNote('Оставить только мой несохранённый текст');await c.refresh();assert.equal(c.state.note,'Оставить только мой несохранённый текст');assert.equal(c.state.detail.content.title,'SyntheticA');
 setWithdrawn(true);await c.preview();assert.equal(c.state.detail,null);assert.equal(c.state.phase,'unavailable');assert.equal(c.state.orphanNote,'Оставить только мой несохранённый текст');assert.equal(JSON.stringify(c.state.data).includes('SyntheticA'),false);
});
test('late alpha GET after logout/login beta cannot repopulate beta view or old note',async()=>{
 const h=harness();await h.c.refresh();await h.c.select(A.id);h.c.setNote('private synthetic alpha draft');const d=deferred();h.setLateState(d);const oldRefresh=h.c.refresh();await Promise.resolve();await h.c.logout();await h.c.login('beta_qa','synthetic-password');d.resolve({packets:[A]});await oldRefresh;
 assert.equal(h.c.state.user.name,'beta_qa');assert.deepEqual(h.c.state.data,{packets:[B]});assert.equal(h.c.state.note,'');assert.equal(h.c.state.orphanNote,'');assert.equal(h.c.state.detail,null);assert.equal(JSON.stringify(h.c.state).includes('SyntheticA'),false);
});
test('suspend immediately clears rendered data and return revalidates session and withdrawn access without autoack',async()=>{
 const h=harness();await h.c.refresh();await h.c.select(A.id);h.c.setNote('Live memory note');h.c.hide();assert.equal(h.c.state.phase,'hidden');assert.equal(h.c.state.data,null);assert.equal(h.c.state.detail,null);h.setWithdrawn(true);await h.c.refresh();assert.equal(h.c.state.phase,'unavailable');assert.equal(h.c.state.orphanNote,'Live memory note');assert.equal(h.calls.filter(x=>x.path==='/api/acknowledge').length,0);
});
test('lost acknowledgement response means unknown outcome,no automaticretry;explicit scoped reread finds one terminalresult',async()=>{
 const h=harness();await h.c.refresh();await h.c.select(A.id);h.c.setNote('Синтетическая отметка');h.setLost(true);await h.c.acknowledge();assert.equal(h.c.state.phase,'unknown');assert.equal(h.c.state.detail,null);assert.equal(h.c.state.data,null);assert.equal(h.calls.filter(x=>x.path==='/api/acknowledge').length,1);
 await h.c.refresh();assert.equal(h.c.state.detail.state,'acknowledged');assert.equal(h.c.state.detail.acknowledgement.note,'Синтетическая отметка');assert.equal(h.calls.filter(x=>x.path==='/api/acknowledge').length,1);
});
test('changed session or401 clears old identity note/content rather than preserving a cross-account draft',async()=>{
 const h=harness();await h.c.refresh();await h.c.select(A.id);h.c.setNote('Onlyalpha');h.setUser(beta);await h.c.refresh();assert.equal(h.c.state.user.name,'beta_qa');assert.equal(h.c.state.note,'');assert.equal(h.c.state.selectedId,null);assert.deepEqual(h.c.state.data,{packets:[B]});
 let fail=false;const c=createCabinet(async path=>{if(fail)throw failure(401);return path==='/api/session'?{user:alpha}:path==='/api/state'?{packets:[A]}:{packet:A};});await c.refresh();await c.select(A.id);c.setNote('Onlyalpha');fail=true;await c.refresh();assert.equal(c.state.phase,'login');assert.equal(c.state.user,null);assert.equal(c.state.note,'');assert.equal(c.state.detail,null);
});

 test('late committed alpha POST response is ignored after beta login and no old content appears',async()=>{
 const h=harness();await h.c.refresh();await h.c.select(A.id);h.c.setNote('Синтетическая отметка');const d=deferred();h.setLateAck(d);const old=h.c.acknowledge();await Promise.resolve();await h.c.logout();await h.c.login('beta_qa','synthetic-password');d.resolve();await old;assert.equal(h.c.state.user.name,'beta_qa');assert.deepEqual(h.c.state.data,{packets:[B]});assert.equal(h.c.state.detail,null);assert.equal(h.c.state.note,'');assert.equal(h.calls.filter(x=>x.path==='/api/acknowledge').length,1);
 });
 test('late admin command response cannot restore admin data after login to recipient',async()=>{
 let user={name:'admin_qa',role:'admin',csrf:'synthetic-csrf'};const d=deferred();const c=createCabinet(async(path,options={})=>{if(path==='/api/session')return {user};if(path==='/api/state')return user.role==='admin'?{revision:0,data:{templates:[],publications:[],dispatches:[],terminals:[],keys:[]}}:{packets:[B]};if(path==='/api/users')return {users:[]};if(path==='/api/command')return d.promise;if(path==='/api/logout')return {loggedOut:true};if(path==='/api/login'){user=beta;return {user};}throw Error('Unexpectedpath');});await c.refresh();const old=c.adminWrite('/api/command',{action:'template.create'});await Promise.resolve();await c.logout();await c.login('beta_qa','synthetic-password');d.resolve({revision:99,data:{templates:[{title:'PRIVATE_ADMIN'}]}});await old;assert.equal(c.state.user.name,'beta_qa');assert.deepEqual(c.state.data,{packets:[B]});assert.equal(JSON.stringify(c.state).includes('PRIVATE_ADMIN'),false);
 });

test('repeated same-account404 refresh preserves the already separated unsaved note until logout or identity change',async()=>{
 const h=harness();await h.c.refresh();await h.c.select(A.id);h.c.setNote('Keep exact unsaved note after repeated404');h.setWithdrawn(true);await h.c.refresh();assert.equal(h.c.state.orphanNote,'Keep exact unsaved note after repeated404');await h.c.refresh();assert.equal(h.c.state.orphanNote,'Keep exact unsaved note after repeated404');assert.equal(h.c.state.detail,null);await h.c.logout();assert.equal(h.c.state.orphanNote,'');
});

test('publication preview applies only to the exact template content version and workspace revision',()=>{
 const t={id:'template-A',version:2},p={templateId:t.id,content:{title:'A',version:2}},result={path:'/api/preview',request:{action:'publish',templateId:t.id,contentVersion:2,revision:7},result:{revision:7,wouldChange:true,data:{publications:[p]}}};
 assert.deepEqual(publicationPreviewFor(result,t,7),p);
 for(const [r,template,revision]of[[result,{id:'template-B',version:2},7],[result,{...t,version:3},7],[result,t,8],[{...result,request:{...result.request,action:'template.create'}},t,7],[{...result,result:{...result.result,wouldChange:false}},t,7]])assert.equal(publicationPreviewFor(r,template,revision),null);
});
test('admin working list excludes archived issues and explicit history retains every immutable row',()=>{
 const available={id:'available',adminArchived:false},archived={id:'archived',adminArchived:true},rows=[available,archived];assert.deepEqual(adminDispatchRows(rows),[available]);assert.deepEqual(adminDispatchRows(rows,true),rows);assert.equal(rows.length,2);
});
test('admin preview remembers immutable request context and selection invalidation rejects an already pending reply',async()=>{
 const admin={name:'admin_qa',role:'admin',csrf:'qa'},d=deferred(),template={id:'template-A',version:2};const c=createCabinet(async(path)=>path==='/api/session'?{user:admin}:path==='/api/state'?{revision:7,data:{templates:[template]}}:path==='/api/users'?{users:[]}:d.promise);await c.refresh();const body={action:'publish',templateId:template.id,revision:7,requestKey:'synthetic-key'},old=c.adminRead('/api/preview',body);await Promise.resolve();body.templateId='template-B';c.clearAdminResult();d.resolve({revision:7,wouldChange:true,data:{publications:[{templateId:template.id,content:{version:2}}]}});await old;assert.equal(c.state.adminResult,null);assert.equal(c.state.busy,false);
 const input={action:'publish',templateId:template.id,revision:7};await c.adminRead('/api/preview',input);input.templateId='template-B';assert.equal(c.state.adminResult.request.templateId,template.id);assert.equal(c.state.adminResult.request.contentVersion,2);
});
