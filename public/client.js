// In-memory controller only. Transport tests cover lifecycle;real browser proof is separate.
export function publicationPreviewFor(result,template,revision){
 const request=result?.request,value=result?.result,p=value?.data?.publications?.at(-1);
 return result?.path==='/api/preview'&&request?.action==='publish'&&request.templateId===template.id&&request.contentVersion===template.version&&request.revision===revision&&value.revision===revision&&value.wouldChange===true&&p?.templateId===template.id&&p.content.version===template.version?p:null;
}
export const adminDispatchRows=(rows,history=false)=>history?rows:rows.filter(row=>!row.adminArchived);
export function createCabinet(transport,onChange=()=>{}){
 const state={user:null,data:null,detail:null,selectedId:null,note:'',orphanNote:'',preview:null,phase:'login',busy:false,error:'',notice:'',adminUsers:null,adminResult:null};let generation=0,readGeneration=0;
 const emit=()=>onChange(state),identity=u=>u?u.name+':'+u.role:null;
 function clear(){state.user=null;state.data=null;state.detail=null;state.selectedId=null;state.note='';state.orphanNote='';state.preview=null;state.adminUsers=null;state.adminResult=null;}
 function failure(e){
  state.busy=false;state.preview=null;
  if(e.status===401){clear();state.phase='login';state.error='Сеанс недоступен. Войдите снова.';}
  else if(e.status===404){if(state.note!=='')state.orphanNote=state.note;state.note='';state.detail=null;if(state.data?.packets)state.data={packets:state.data.packets.filter(p=>p.id!==state.selectedId)};state.phase='unavailable';state.error='Пакет недоступен. Несохранённое основание оставлено отдельно для копирования.';}
  else {if(e.status===403){state.data=null;state.detail=null;state.adminUsers=null;state.adminResult=null;}state.phase='error';state.error=e.status?'Команда сейчас недоступна. Обновите состояние перед новой попыткой.':'Не удалось прочитать состояние. Повторите обновление.';}
  emit();
 }
 async function refresh(){
  const token=++generation,previous=identity(state.user);state.phase='checking';state.busy=true;state.error='';state.data=null;state.detail=null;state.preview=null;state.adminUsers=null;state.adminResult=null;emit();
  try{
   const s=await transport('/api/session');if(token!==generation)return;
   if(previous&&previous!==identity(s.user)){clear();}state.user=s.user;
   const data=await transport('/api/state');if(token!==generation)return;state.data=data;
   if(state.user.role==='admin'){const users=await transport('/api/users');if(token!==generation)return;state.adminUsers=users.users;}
   if(state.user.role==='operator'&&state.selectedId){const r=await transport('/api/dispatch/'+state.selectedId);if(token!==generation)return;state.detail=r.packet;if(r.packet.state==='acknowledged'){state.note='';state.orphanNote='';}}
   state.phase='ready';state.busy=false;emit();
  }catch(e){if(token===generation)failure(e);}
 }
 async function login(username,password){
  const token=++generation;clear();state.phase='checking';state.busy=true;state.error='';state.notice='';emit();
  try{const r=await transport('/api/login',{method:'POST',body:{username,password}});if(token!==generation)return;state.user=r.user;await refresh();}catch(e){if(token===generation){clear();state.phase='login';state.busy=false;state.error=e.status===401?'Не удалось войти. Проверьте имя и пароль.':'Вход не подтверждён. Повторите явную попытку.';emit();}}
 }
 async function logout(){
  const csrf=state.user?.csrf,token=++generation;clear();state.phase='login';state.busy=true;state.error='';state.notice='';emit();
  try{await transport('/api/logout',{method:'POST',body:{},csrf});if(token===generation){state.busy=false;state.notice='Вы вышли из кабинета.';emit();}}
  catch{if(token===generation){state.busy=false;state.error='Выход на сервере не подтверждён. Проверьте сеанс обновлением;данные на этой странице скрыты.';emit();}}
 }
 async function select(id){if(state.selectedId!==id){state.note='';state.orphanNote='';}state.selectedId=id;state.notice='';await refresh();}
 async function preview(){
  if(!state.detail||state.busy)return;const token=++generation,id=state.selectedId,version=state.detail.version;state.busy=true;state.error='';emit();
  try{const r=await transport('/api/ack-preview',{method:'POST',csrf:state.user.csrf,body:{dispatchUUID:id,expectedVersion:version}});if(token!==generation)return;state.preview=r.packet;state.busy=false;state.phase='ready';state.notice='Предпросмотр разрешения готов. Он не сохраняет отметку.';emit();}catch(e){if(token===generation)failure(e);}
 }
 async function acknowledge(){
  if(!state.detail||state.detail.state!=='available'||state.busy)return;const token=++generation,input={dispatchUUID:state.selectedId,expectedVersion:state.detail.version,requestKey:crypto.randomUUID(),note:state.note},csrf=state.user.csrf;state.busy=true;state.error='';state.notice='';emit();
  try{
   const r=await transport('/api/acknowledge',{method:'POST',csrf,body:input});if(token!==generation)return;
   state.detail=r.packet;if(state.data?.packets)state.data={packets:state.data.packets.map(p=>p.id===r.packet.id?r.packet:p)};state.note='';state.orphanNote='';state.preview=null;state.phase='ready';state.busy=false;state.notice='Ручная отметка аккаунта сохранена один раз.';emit();
  }catch(e){if(token!==generation)return;if(!e.status){state.phase='unknown';state.busy=false;state.detail=null;state.data=null;state.preview=null;state.error='Результат записи неизвестен:ответ мог потеряться после сохранения. Не отправляйте повторно;обновите состояние пакета.';emit();}else failure(e);}
 }
 async function adminWrite(path,body){
  if(state.user?.role!=='admin'||state.busy)return false;const token=++generation,csrf=state.user.csrf;state.busy=true;state.error='';state.notice='';emit();
  try{await transport(path,{method:'POST',body,csrf});if(token!==generation)return false;await refresh();if(state.user?.role==='admin'&&state.phase==='ready'){state.notice='Команда сохранена. Состояние перечитано с сервера.';emit();return true;}return false;}
  catch(e){if(token!==generation)return false;if(!e.status){state.phase='unknown';state.busy=false;state.data=null;state.detail=null;state.adminUsers=null;state.adminResult=null;state.error='Результат записи неизвестен. Не отправляйте команду повторно;сначала перечитайте состояние.';emit();}else failure(e);return false;}
 }
 async function adminRead(path,body){
  if(state.user?.role!=='admin'||state.busy)return;const token=++generation,readToken=++readGeneration,csrf=state.user.csrf,input=body?structuredClone(body):undefined,contentVersion=input?.action==='publish'?state.data.data.templates.find(t=>t.id===input.templateId)?.version:undefined;state.busy=true;state.error='';emit();
  try{const result=await transport(path,{method:input?'POST':'GET',body:input,csrf});if(token!==generation)return;state.busy=false;if(readToken!==readGeneration){emit();return;}state.adminResult={path,request:input?{...input,contentVersion}:null,result};emit();}catch(e){if(token===generation)failure(e);}
 }
 function clearAdminResult(){readGeneration++;state.adminResult=null;}
 function hide(){generation++;state.phase='hidden';state.adminUsers=null;state.adminResult=null;state.data=null;state.detail=null;state.preview=null;state.busy=false;state.error='';state.notice='';emit();}
 function setNote(value){state.note=value;}
 return {state,refresh,login,logout,select,preview,acknowledge,adminWrite,adminRead,clearAdminResult,hide,setNote};
}
