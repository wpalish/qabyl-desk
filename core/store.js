import {DatabaseSync,backup as sqliteBackup} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {requireThat,keys,uuid,integer,problem} from './errors.js';
import {commandShape,applyAdmin,ackShape,applyAck,visible,project,fresh,validateData} from './domain.js';
export const emptyData=()=>({templates:[],publications:[],dispatches:[],terminals:[],keys:[]});
export class PacketStore{
 constructor(path=':memory:',{now=()=>Date.now()}={}){
  this.now=now;if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});this.db=new DatabaseSync(path);
  const app=0x51414259,id=this.db.prepare('PRAGMA application_id').get().application_id,version=this.db.prepare('PRAGMA user_version').get().user_version,n=this.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get().n;
  if(!(id===0&&version===0&&n===0)&&!(id===app&&version===1)){this.db.close();requireThat(false,400);}
  this.db.exec(`PRAGMA busy_timeout=5000;PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,payload TEXT NOT NULL);CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,requestKey TEXT UNIQUE NOT NULL,at TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL);CREATE TABLE IF NOT EXISTS users(name TEXT PRIMARY KEY,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','operator')));CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY,username TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS failures(name TEXT PRIMARY KEY,count INTEGER NOT NULL,since INTEGER NOT NULL);PRAGMA application_id=${app};PRAGMA user_version=1;`);
  this.db.prepare('INSERT OR IGNORE INTO workspace VALUES(1,0,?)').run(JSON.stringify(emptyData()));
 }
 close(){this.db.close();}
 snapshot(){const r=this.db.prepare('SELECT revision,payload FROM workspace WHERE id=1').get();return {revision:r.revision,data:JSON.parse(r.payload)};}
 roleFor(name){return this.db.prepare('SELECT role FROM users WHERE name=?').get(name)?.role;}
 actor(actor,role){requireThat(actor&&actor.role===role&&this.roleFor(actor.name)===role,403);}
 time(){const n=this.now();requireThat(Number.isSafeInteger(n)&&Number.isFinite(new Date(n).getTime()),409);return new Date(n).toISOString();}
 mutate(actor,role,change){
  this.db.exec('BEGIN IMMEDIATE');
  try{
   this.actor(actor,role);const current=this.snapshot(),next=structuredClone(current.data),at=this.time(),r=change(next,current,at);
   if(r.changed!==false){
    fresh(next,r.requestKey);next.keys.push({key:r.requestKey,at,actor:actor.name,action:r.action});
    this.db.prepare('UPDATE workspace SET revision=?,payload=? WHERE id=1').run(current.revision+1,JSON.stringify(next));
    this.db.prepare('INSERT INTO audit(requestKey,at,actor,action) VALUES(?,?,?,?)').run(r.requestKey,at,actor.name,r.action);
   }
   this.db.exec('COMMIT');return r.response??this.snapshot();
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 admin(command,actor){
  commandShape(command);return this.mutate(actor,'admin',(next,current,at)=>{
   requireThat(command.revision===current.revision,409);fresh(next,command.requestKey);
   const changed=applyAdmin(next,command,actor,at,name=>this.roleFor(name));return {changed,requestKey:command.requestKey,action:command.action};
  });
 }
 recipientState(actor){this.actor(actor,'operator');const d=this.snapshot().data;return {packets:d.dispatches.filter(r=>r.recipient===actor.name&&r.state!=='withdrawn').map(r=>project(d,r))};}
 packet(id,actor){uuid(id);this.actor(actor,'operator');const d=this.snapshot().data;return {packet:project(d,visible(d,id,actor.name))};}
 preview(input,actor){ackShape(input,true);this.actor(actor,'operator');const d=this.snapshot().data,r=visible(d,input.dispatchUUID,actor.name);requireThat(r.state==='available'&&r.version===input.expectedVersion,409);return {packet:project(d,r),canAcknowledge:true};}
 acknowledge(input,actor){
  ackShape(input);return this.mutate(actor,'operator',(d,current,at)=>({response:applyAck(d,input,actor,at),requestKey:input.requestKey,action:'acknowledge'}));
 }
 backup(actor){this.actor(actor,'admin');return {format:'qabyl-desk-v1',data:this.snapshot().data};}
 restore(input,actor){
  keys(input,['backup','revision','requestKey']);integer(input.revision,0);uuid(input.requestKey);keys(input.backup,['format','data']);requireThat(input.backup.format==='qabyl-desk-v1');
  return this.mutate(actor,'admin',(next,current,at)=>{
   requireThat(input.revision===current.revision&&Object.values(next).every(x=>x.length===0),409);
   const restored=structuredClone(input.backup.data);try{validateData(restored,name=>this.roleFor(name),at);}catch{throw problem(400);}fresh(restored,input.requestKey);for(const k of Object.keys(next))next[k]=restored[k];
   return {requestKey:input.requestKey,action:'restore'};
  });
 }
 async backupFile(path){return sqliteBackup(this.db,path);}
}
