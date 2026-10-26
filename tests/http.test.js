import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import {createServer} from '../core/server.js';
const password='synthetic-HTTP-test-password';
async function fixture(t){
 const app=createServer({admin:{username:'admin_qa',password}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+app.server.address().port;
 t.after(async()=>{await new Promise(r=>app.server.close(r));app.store.close();});
 async function request(path,{method='GET',user,body,raw,headers={}}={}){
  if(headers.Host){
   const payload=raw??(body===undefined?undefined:JSON.stringify(body));
   return new Promise((resolve,reject)=>{const req=http.request(origin+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(user?{Cookie:user.cookie,'X-CSRF-Token':user.csrf}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const txt=Buffer.concat(chunks).toString();resolve({status:res.statusCode,data:JSON.parse(txt),text:txt,headers:new Headers(res.headers)});});});req.on('error',reject);req.end(payload);});
  }
  const res=await fetch(origin+path,{method,headers:{...(method!=='GET'&&method!=='HEAD'?{'Content-Type':'application/json',Origin:origin}:{}),...(user?{Cookie:user.cookie,'X-CSRF-Token':user.csrf}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body)),redirect:'manual'});const txt=await res.text();let data;try{data=JSON.parse(txt);}catch{data=txt;}return {status:res.status,data,headers:res.headers,text:txt};
 }
 const login=async name=>{const r=await request('/api/login',{method:'POST',body:{username:name,password}});assert.equal(r.status,200);return {cookie:r.headers.get('set-cookie').split(';')[0],csrf:r.data.user.csrf,name};};
 const admin=await login('admin_qa');
 for(const name of ['alpha_qa','beta_qa'])assert.equal((await request('/api/users',{method:'POST',user:admin,body:{username:name,password,role:'operator'}})).status,201);
 const alpha=await login('alpha_qa'),beta=await login('beta_qa');
 async function command(action,fields={}){const revision=(await request('/api/state',{user:admin})).data.revision;const r=await request('/api/command',{method:'POST',user:admin,body:{action,revision,requestKey:randomUUID(),...fields}});assert.equal(r.status,200,r.text);return r.data;}
 await command('template.create',{code:'SYN_HTTP',title:'Пакет только для синтетического HTTP'});const templateId=app.store.snapshot().data.templates[0].id;
 await command('section.save',{templateId,sectionId:null,position:1,titleRu:'Русский',titleKk:'Қазақша',textRu:'Вымышленное содержание <script>alert(1)</script>',textKk:'Ойдан шығарылған мәтін'});await command('publish',{templateId});const publicationId=app.store.snapshot().data.publications[0].id;
 for(const recipient of ['alpha_qa','beta_qa'])await command('dispatch',{publicationId,recipient,language:recipient==='alpha_qa'?'kk':'ru'});
 const [A,B]=app.store.snapshot().data.dispatches;return {...app,origin,request,command,login,admin,alpha,beta,A,B};
}
function fixedError(r,status,code){assert.equal(r.status,status,r.text);assert.deepEqual(Object.keys(r.data),['error']);assert.equal(r.data.error.code,code);assert.equal(r.headers.get('cache-control'),'no-store');}
async function refused(f,call,status){const before=f.store.snapshot(),audit=f.store.db.prepare('SELECT * FROM audit').all(),r=await call();assert.equal(r.status,status,r.text);assert.deepEqual(f.store.snapshot(),before);assert.deepEqual(f.store.db.prepare('SELECT * FROM audit').all(),audit);return r;}

test('every operator route is scoped or refused independently; anonymous and static routes contain no domain rows',async t=>{
 const f=await fixture(t),{request,alpha,A,B}=f;
 const state=await request('/api/state',{user:alpha});assert.equal(state.status,200);assert.deepEqual(state.data,f.store.recipientState({name:'alpha_qa',role:'operator'}));assert.equal(JSON.stringify(state.data).includes(B.id),false);
 assert.deepEqual((await request('/api/dispatch/'+A.id,{user:alpha})).data,state.data.packets.length?{packet:state.data.packets[0]}:null);
 for(const [method,path,body]of [['GET','/api/users'],['POST','/api/users',{}],['GET','/api/audit'],['GET','/api/backup'],['POST','/api/restore',{}],['POST','/api/command',{}],['POST','/api/preview',{}]])fixedError(await refused(f,()=>request(path,{method,user:alpha,body}),403),403,'FORBIDDEN');
 for(const path of ['/api/state','/api/users','/api/audit','/api/backup','/api/dispatch/'+A.id])fixedError(await request(path),401,'UNAUTHENTICATED');
 const config=await request('/api/config');assert.equal(config.status,200);assert.equal(JSON.stringify(config.data).includes('alpha_qa'),false);assert.equal(JSON.stringify(config.data).includes(A.id),false);
 for(const path of ['/','/app.js','/styles.css']){const r=await request(path);assert.equal(r.status,200);assert.equal(r.text.includes(A.id),false);assert.equal(r.text.includes(password),false);}
});
test('foreign unknown and withdrawn GET/preview/ack return identical404 even with reused key and wrong version',async t=>{
 const f=await fixture(t),{request,alpha,A,B,command}=f;await command('withdraw',{dispatchUUID:A.id,expectedVersion:1,note:'Явный отзыв'});const seen=f.store.snapshot().data.keys[0].key,responses=[];
 for(const dispatchUUID of [A.id,B.id,randomUUID()]){
  responses.push((await refused(f,()=>request('/api/dispatch/'+dispatchUUID,{user:alpha}),404)).text);
  responses.push((await refused(f,()=>request('/api/ack-preview',{method:'POST',user:alpha,body:{dispatchUUID,expectedVersion:999}}),404)).text);
  responses.push((await refused(f,()=>request('/api/acknowledge',{method:'POST',user:alpha,body:{dispatchUUID,expectedVersion:999,requestKey:seen,note:'Метка'}}),404)).text);
 }assert.equal(new Set(responses).size,1);fixedError({status:404,data:JSON.parse(responses[0]),headers:new Headers({'cache-control':'no-store'})},404,'NOT_FOUND');
});
test('successful ack POST returns same recursive projection as GET and unrelated admin edit does not stale object',async t=>{
 const f=await fixture(t),{request,alpha,A,command}=f;const preview=await request('/api/ack-preview',{method:'POST',user:alpha,body:{dispatchUUID:A.id,expectedVersion:1}});assert.equal(preview.status,200);assert.equal(preview.data.canAcknowledge,true);
 await command('template.create',{code:'UNRELATED',title:'Другой черновик'});const input={dispatchUUID:A.id,expectedVersion:1,requestKey:randomUUID(),note:'Явная синтетическая отметка'};
 const result=await request('/api/acknowledge',{method:'POST',user:alpha,body:input});assert.equal(result.status,200);assert.deepEqual(result.data,(await request('/api/dispatch/'+A.id,{user:alpha})).data);assert.equal(result.data.packet.state,'acknowledged');for(const k of ['revision','recipient','publicationId','requestKey','audit','users','keys'])assert.equal(result.text.includes('"'+k+'"'),false);
 fixedError(await refused(f,()=>request('/api/acknowledge',{method:'POST',user:alpha,body:input}),409),409,'CONFLICT');
});
test('strict raw JSON rejects escaped duplicate keys and bad types without confusing literal JSON-looking note',async t=>{
 const f=await fixture(t),{request,alpha,A}=f;const input={dispatchUUID:A.id,expectedVersion:1,requestKey:randomUUID(),note:'{"expectedVersion":5} <b>plain</b>'},base=JSON.stringify(input);
 const bad=[base.slice(0,-1)+',"expectedVersion":1}',base.slice(0,-1)+',"expected\\u0056ersion":1}',base.slice(0,-1)+',"recipient":"beta_qa"}',JSON.stringify({...input,expectedVersion:'1'}),JSON.stringify({...input,requestKey:input.requestKey.toUpperCase()}),'{"note":{"a":1,"a":2}}'];
 for(const raw of bad)fixedError(await refused(f,()=>request('/api/acknowledge',{method:'POST',user:alpha,raw}),400),400,'BAD_REQUEST');
 assert.equal((await request('/api/acknowledge',{method:'POST',user:alpha,body:input})).status,200);
});
test('API paths queryselectors conditionals methodvariants and HEAD cannot bypass filtering or cache across accounts',async t=>{
 const f=await fixture(t),{request,alpha,A,B}=f;
 for(const path of ['/api/state?recipient=beta_qa','/api/dispatch/'+A.id+'?expand=all'])fixedError(await request(path,{user:alpha}),400,'BAD_REQUEST');
 for(const path of ['/api/public/test','/api/dispatch/'+B.id.toUpperCase(),'/api/%73tate','/api/unknown','/.data/work.sqlite','/core/store.js'])assert.equal((await request(path,{user:alpha})).status,404);
 const own=await request('/api/dispatch/'+A.id,{user:alpha,headers:{'If-None-Match':'*','If-Modified-Since':'Wed, 01 Jan 2030 00:00:00 GMT'}});assert.equal(own.status,200);assert.equal(own.headers.get('cache-control'),'no-store');
 const foreign=await request('/api/dispatch/'+B.id,{user:alpha,headers:{'If-None-Match':'*'}});fixedError(foreign,404,'NOT_FOUND');
 for(const [method,path]of [['HEAD','/api/state'],['PUT','/api/state'],['GET','/api/acknowledge'],['POST','/api/config']]){const r=await request(path,{method,user:alpha,body:method==='POST'?{}:undefined});assert.equal(r.status,405);if(method==='HEAD')assert.equal(r.text,'');else assert.equal(r.data.error.code,'METHOD_NOT_ALLOWED');}
});
test('real session cookie csrf origin host payload limit and generic credential errors protect every mutation',async t=>{
 const f=await fixture(t),{request,alpha,A,origin}=f;const input={dispatchUUID:A.id,expectedVersion:1,requestKey:randomUUID(),note:'Метка'};
 assert.match(alpha.cookie,/^qd_session=/);const login=await request('/api/login',{method:'POST',body:{username:'alpha_qa',password}});assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
 for(const headers of [{'X-CSRF-Token':'bad'},{Origin:'https://outside.invalid'},{Host:'outside.invalid'}])fixedError(await refused(f,()=>request('/api/acknowledge',{method:'POST',user:alpha,body:input,headers}),403),403,'FORBIDDEN');
 const huge=await refused(f,()=>request('/api/acknowledge',{method:'POST',user:alpha,raw:JSON.stringify({...input,note:'x'.repeat(2097152)})}),413);fixedError(huge,413,'TOO_LARGE');
 const a=await request('/api/login',{method:'POST',body:{username:'missing_qa',password:'bad'}}),b=await request('/api/login',{method:'POST',body:{username:'alpha_qa',password:'bad'}});assert.equal(a.status,401);assert.equal(a.text,b.text);assert.equal(a.headers.get('cache-control'),'no-store');
 const session=await request('/api/session',{user:alpha});assert.deepEqual(Object.keys(session.data),['user']);assert.deepEqual(Object.keys(session.data.user).sort(),['csrf','name','role']);assert.equal(session.data.user.name,'alpha_qa');assert.equal(origin.startsWith('http://127.0.0.1:'),true);
});
test('logout invalidates actual cookie and HTTP restore requires current roles before accepting backup',async t=>{
 const f=await fixture(t),{request,alpha,admin,store}=f;const b=await request('/api/backup',{user:admin});assert.equal(b.status,200);fixedError(await refused(f,()=>request('/api/restore',{method:'POST',user:alpha,body:{backup:b.data,revision:0,requestKey:randomUUID()}}),403),403,'FORBIDDEN');
 assert.equal((await request('/api/logout',{method:'POST',user:alpha,body:{}})).status,200);fixedError(await request('/api/session',{user:alpha}),401,'UNAUTHENTICATED');
 store.db.prepare('UPDATE users SET role=? WHERE name=?').run('admin','beta_qa');
 const empty=createServer({admin:{username:'admin_qa',password}});await new Promise(r=>empty.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>empty.server.close(r));empty.store.close();});
 const orig='http://127.0.0.1:'+empty.server.address().port;const login=await fetch(orig+'/api/login',{method:'POST',headers:{Origin:orig,'Content-Type':'application/json'},body:JSON.stringify({username:'admin_qa',password})});const j=await login.json(),cookie=login.headers.get('set-cookie').split(';')[0];
 const r=await fetch(orig+'/api/restore',{method:'POST',headers:{Origin:orig,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':j.user.csrf},body:JSON.stringify({backup:b.data,revision:0,requestKey:randomUUID()})});assert.equal(r.status,400);assert.equal(empty.store.snapshot().revision,0);
});

test('admin preview is read-only, stale admin command is atomic, admin cannot mark and fresh current-role session never retains operator rights',async t=>{
 const f=await fixture(t),{request,admin,alpha,A,command,store}=f;const before=store.snapshot(),audit=store.db.prepare('SELECT * FROM audit').all();
 const preview=await request('/api/preview',{method:'POST',user:admin,body:{action:'template.create',revision:before.revision,requestKey:randomUUID(),code:'PREVIEW_ONLY',title:'Только предпросмотр'}});assert.equal(preview.status,200);assert.equal(preview.data.wouldChange,true);assert.deepEqual(store.snapshot(),before);assert.deepEqual(store.db.prepare('SELECT * FROM audit').all(),audit);
 await command('template.create',{code:'SECOND',title:'Другой шаблон'});await refused(f,()=>request('/api/command',{method:'POST',user:admin,body:{action:'template.create',revision:before.revision,requestKey:randomUUID(),code:'STALE',title:'Устаревший'}}),409);
 fixedError(await refused(f,()=>request('/api/acknowledge',{method:'POST',user:admin,body:{dispatchUUID:A.id,expectedVersion:1,requestKey:randomUUID(),note:'Админ за получателя'}}),403),403,'FORBIDDEN');
 store.db.prepare('UPDATE users SET role=? WHERE name=?').run('admin','alpha_qa');assert.equal((await request('/api/session',{user:alpha})).data.user.role,'admin');fixedError(await refused(f,()=>request('/api/ack-preview',{method:'POST',user:alpha,body:{dispatchUUID:A.id,expectedVersion:1}}),403),403,'FORBIDDEN');
});

test('empty HTTP restore succeeds only with all referenced current accounts and excludes users auth audit from JSON',async t=>{
 const f=await fixture(t),{request,admin,alpha,A}=f;assert.equal((await request('/api/acknowledge',{method:'POST',user:alpha,body:{dispatchUUID:A.id,expectedVersion:1,requestKey:randomUUID(),note:'Сохранённая модельная отметка'}})).status,200);const backup=(await request('/api/backup',{user:admin})).data;
 const app=createServer({admin:{username:'admin_qa',password}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));app.store.close();});const origin='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,body,user)=>{const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(user?{Cookie:user.cookie,'X-CSRF-Token':user.csrf}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),headers:r.headers};};
 const login=await call('/api/login',{username:'admin_qa',password}),u={cookie:login.headers.get('set-cookie').split(';')[0],csrf:login.data.user.csrf};
 for(const name of ['alpha_qa','beta_qa'])assert.equal((await call('/api/users',{username:name,password,role:'operator'},u)).status,201);
 const result=await call('/api/restore',{backup,revision:0,requestKey:randomUUID()},u);assert.equal(result.status,200);assert.equal(app.store.snapshot().data.dispatches.length,2);assert.equal(app.store.snapshot().data.terminals.length,1);assert.deepEqual(app.store.recipientState({name:'alpha_qa',role:'operator'}),f.store.recipientState({name:'alpha_qa',role:'operator'}));
 assert.equal(app.store.db.prepare('SELECT count(*) n FROM sessions').get().n,1);assert.equal(app.store.db.prepare('SELECT count(*) n FROM audit').get().n,1);
});
