import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {PacketStore} from './store.js';
import {definition} from '../module.js';
import {body} from './json.js';
import {requireThat,problem,publicError,keys,text,username,UUID} from './errors.js';
import {commandShape,applyAdmin,fresh} from './domain.js';
const random=()=>randomBytes(32).toString('hex'),digest=s=>createHash('sha256').update(s).digest('hex');
function passwordHash(password){requireThat(typeof password==='string'&&password.length>=14&&password.length<=200);const salt=random();return salt+':'+scryptSync(password,salt,64).toString('hex');}
function passwordMatches(password,hash){if(typeof password!=='string'||password.length>200)return false;const [salt,key]=hash.split(':');const actual=scryptSync(password,salt,64),expected=Buffer.from(key,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
const cookies=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('qd_session=')).map(x=>x.slice(11));
export function createServer({database=':memory:',origin=null,admin,now=()=>Date.now()}={}){
 const store=new PacketStore(database,{now}),db=store.db,dummy=passwordHash(random());
 function createUser(input){keys(input,['username','password','role']);const name=username(input.username);requireThat(['admin','operator'].includes(input.role));const encoded=passwordHash(input.password);requireThat(!db.prepare('SELECT 1 FROM users WHERE name=?').get(name),409);db.prepare('INSERT INTO users VALUES(?,?,?)').run(name,encoded,input.role);return {username:name,role:input.role};}
 if(admin&&!db.prepare('SELECT 1 FROM users LIMIT 1').get())createUser({username:admin.username,password:admin.password,role:'admin'});
 function session(req){const values=cookies(req);if(values.length!==1)return null;return db.prepare('SELECT u.name,u.role,s.csrf FROM sessions s JOIN users u ON u.name=s.username WHERE s.digest=? AND s.expires>?').get(digest(values[0]),now())||null;}
 function auth(req,role){const u=session(req);requireThat(u,401);requireThat(!role||u.role===role,403);if(req.method==='POST')requireThat(req.headers['x-csrf-token']===u.csrf,403);return {name:u.name,role:u.role,csrf:u.csrf};}
 const publicUser=u=>({user:{name:u.name,role:u.role,csrf:u.csrf}});
 const methods=new Map([['/api/config','GET'],['/api/login','POST'],['/api/session','GET'],['/api/logout','POST'],['/api/state','GET'],['/api/acknowledge','POST'],['/api/ack-preview','POST'],['/api/command','POST'],['/api/preview','POST'],['/api/users','GET POST'],['/api/audit','GET'],['/api/backup','GET'],['/api/restore','POST']]);
 const staticFiles=new Map([['/','index.html'],['/app.js','app.js'],['/styles.css','styles.css'],['/client.js','client.js']]);
 const rate=new Map();
 const server=http.createServer(async(req,res)=>{
  const headers={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self';base-uri 'none';object-src 'none';frame-ancestors 'none';form-action 'self';script-src 'self';style-src 'self';connect-src 'self';img-src 'self';font-src 'self'",'Cache-Control':'no-store'};
  for(const [k,v]of Object.entries(headers))res.setHeader(k,v);
  const send=(status,data,extra={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(req.method==='HEAD'?'':JSON.stringify(data));};
  try{
   const expected=origin||'http://127.0.0.1:'+server.address().port,base=new URL(expected);requireThat(req.headers.host===base.host,403);requireThat(!req.headers.origin||req.headers.origin===expected,403);if(req.method==='POST')requireThat(req.headers.origin===expected,403);
   const address=req.url||'/',url=new URL(address,expected),rawPath=address.split('?')[0];requireThat(address.startsWith('/')&&url.origin===expected&&rawPath===url.pathname&&!rawPath.includes('%'),404);const path=url.pathname;
   const ip=req.socket.remoteAddress||'local',r=rate.get(ip)||{at:now(),count:0};if(now()-r.at>60000){r.at=now();r.count=0;}requireThat(++r.count<=600,429);rate.set(ip,r);if(rate.size>2000)rate.clear();
   if(url.search)throw problem(400);
   const isDispatch=/^\/api\/dispatch\//.test(path)&&UUID.test(path.slice('/api/dispatch/'.length)),allowed=isDispatch?'GET':methods.get(path);
   if(allowed){
    requireThat(allowed.split(' ').includes(req.method),405);
    if(path==='/api/config'){send(200,definition);return;}
    if(path==='/api/login'){
     const b=await body(req);keys(b,['username','password']);const name=username(b.username);requireThat(typeof b.password==='string'&&b.password.length<=200);const key=digest(ip+':'+name),failure=db.prepare('SELECT * FROM failures WHERE name=?').get(key);requireThat(!failure||now()-failure.since>=900000||failure.count<15,429);
     const user=db.prepare('SELECT * FROM users WHERE name=?').get(name),matched=passwordMatches(b.password,user?.password||dummy);
     if(!user||!matched){db.prepare('INSERT INTO failures VALUES(?,1,?) ON CONFLICT(name) DO UPDATE SET count=CASE WHEN excluded.since-failures.since>=900000 THEN 1 ELSE failures.count+1 END,since=CASE WHEN excluded.since-failures.since>=900000 THEN excluded.since ELSE failures.since END').run(key,now());throw problem(401);}
     db.prepare('DELETE FROM failures WHERE name=?').run(key);const token=random(),csrf=random();db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),name,csrf,now()+86400000);
     send(200,publicUser({name,role:user.role,csrf}),{'Set-Cookie':`qd_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${base.protocol==='https:'?'; Secure':''}`});return;
    }
    if(path==='/api/session'){send(200,publicUser(auth(req)));return;}
    if(path==='/api/logout'){auth(req);keys(await body(req),[]);const values=cookies(req);db.prepare('DELETE FROM sessions WHERE digest=?').run(digest(values[0]));send(200,{loggedOut:true},{'Set-Cookie':'qd_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});return;}
    if(path==='/api/state'){const u=auth(req);send(200,u.role==='admin'?store.snapshot():store.recipientState(u));return;}
    if(isDispatch){const u=auth(req),id=path.slice('/api/dispatch/'.length);if(u.role==='operator')send(200,store.packet(id,u));else{const d=store.snapshot().data,row=d.dispatches.find(x=>x.id===id);requireThat(row,404);send(200,{dispatch:row,terminal:d.terminals.find(x=>x.dispatchId===id)||null});}return;}
    if(path==='/api/acknowledge'||path==='/api/ack-preview'){const u=auth(req,'operator'),input=await body(req);send(200,path==='/api/acknowledge'?store.acknowledge(input,u):store.preview(input,u));return;}
    auth(req,'admin');
    if(path==='/api/users'){
     if(req.method==='GET'){send(200,{users:db.prepare('SELECT name,role FROM users ORDER BY name').all()});return;}
     const b=await body(req);db.exec('BEGIN IMMEDIATE');try{auth(req,'admin');const created=createUser(b);db.exec('COMMIT');send(201,created);}catch(e){db.exec('ROLLBACK');throw e;}return;
    }
    if(path==='/api/audit'){send(200,{audit:db.prepare('SELECT seq,at,actor,action FROM audit ORDER BY seq DESC LIMIT 200').all()});return;}
    if(path==='/api/backup'){send(200,store.backup(auth(req,'admin')));return;}
    if(path==='/api/restore'){const b=await body(req);send(200,store.restore(b,auth(req,'admin')));return;}
    if(path==='/api/command'){const b=await body(req);send(200,store.admin(b,auth(req,'admin')));return;}
    if(path==='/api/preview'){
     const b=await body(req),u=auth(req,'admin');commandShape(b);db.exec('BEGIN');try{const current=store.snapshot();requireThat(b.revision===current.revision,409);const next=structuredClone(current.data);fresh(next,b.requestKey);const changed=applyAdmin(next,b,u,store.time(),name=>store.roleFor(name));db.exec('ROLLBACK');send(200,{revision:current.revision,wouldChange:changed,data:next});}catch(e){db.exec('ROLLBACK');throw e;}return;
    }
   }
   if(path.startsWith('/api/'))throw problem(404);
   const file=staticFiles.get(path);requireThat(file,404);requireThat(['GET','HEAD'].includes(req.method),405);const bytes=await readFile(new URL('../public/'+file,import.meta.url));res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?'':bytes);
  }catch(e){if(!req.readableEnded)req.resume();send([400,401,403,404,405,409,413,429].includes(e.status)?e.status:500,publicError(e.status));}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return {server,store};
}
