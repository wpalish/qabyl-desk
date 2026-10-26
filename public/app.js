import {createCabinet,publicationPreviewFor,adminDispatchRows} from './client.js';
const root=document.querySelector('#app'); let controlSeq=0;
const E=(tag, attrs={}, children=[])=>{const e=document.createElement(tag); for(const [k, v]of Object.entries(attrs)){if(k==='text')e.textContent=v; else if(k.startsWith('on'))e.addEventListener(k.slice(2).toLowerCase(), v); else if(v!==false&&v!==null&&v!==undefined)e.setAttribute(k, v===true?'':String(v));}for(const c of [children].flat(Infinity))if(c!==undefined&&c!==null)e.append(c instanceof Node?c:document.createTextNode(String(c))); return e;};
const P=(text, cls='')=>E('p',{text, class:cls});
const button=(text, fn, cls='', disabled=false)=>E('button',{id:'action-'+(++controlSeq), type:'button', text, class:cls, disabled, onClick:fn});
const status=s=>({available:'Ожидает ручной отметки', acknowledged:'Ручная отметка сохранена', withdrawn:'Отозван'})[s]||s;
const stamp=s=>new Date(s).toLocaleString('ru-RU',{timeZone:'UTC'})+' UTC';
const ui={pane:'templates', template:null, dispatch:null, showHistory:false, language:null, drafts:new Map(), error:'', identity:null, lastError:'', lastNotice:''};
async function transport(path,{method='GET', body, csrf}={}){
 const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(), 15000);
 try{const r=await fetch(path,{method, credentials:'same-origin', cache:'no-store', signal:controller.signal, headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})}, body:body===undefined?undefined:JSON.stringify(body)}); const value=await r.json(); if(!r.ok)throw Object.assign(new Error(value.error?.message||'Запрос недоступен.'),{status:r.status}); return value;}finally{clearTimeout(timeout);}
}
const cabinet=createCabinet(transport,()=>render());
function resetUI(){ui.pane='templates'; ui.template=null; ui.dispatch=null; ui.showHistory=false; ui.language=null; ui.drafts.clear(); ui.error='';}
function field(form, key, label,{type='text', value='', required=true, max=200, options, help}={}, draft){
 const id='field-'+form.id+'-'+key; const attrs={id, name:key, required, maxlength:max,...(help?{'aria-describedby':id+'-help'}:{})}; let input;
 if(options){input=E('select', attrs, options.map(o=>E('option',{value:o.value, disabled:o.disabled, text:o.label})));}
 else if(type==='textarea')input=E('textarea', attrs); else input=E('input',{...attrs, type, autocomplete:type==='password'?'current-password':'off'});
 input.value=draft&&Object.hasOwn(draft, key)?draft[key]:(value||(options?.[0]?.value??'')); if(type==='number'){input.min='1'; input.max='20'; input.step='1';}if(type==='password'&&form.id==='new-user')input.autocomplete='new-password';
 if(draft)input.addEventListener('input',()=>{draft[key]=input.value;});
 const wrap=E('div',{},[E('label',{for:id, text:label}), input, help?E('p',{id:id+'-help', class:'helper', text:help}):null]); form.append(wrap); return input;
}
function adminForm(host, id, fields, build, label,{clear=true}={}){
 const state=cabinet.state, f=E('form',{id}), draft=ui.drafts.get(id)||{}; ui.drafts.set(id, draft); for(const [key, title, options]of fields)field(f, key, title, options, draft);
 const revision=state.data.revision; f.append(E('button',{type:'submit', id:id+'-submit', text:label, class:'primary', disabled:state.busy||state.phase!=='ready'}));
 f.addEventListener('submit', async event=>{event.preventDefault(); if(!f.reportValidity())return; const values=Object.fromEntries(new FormData(f)); try{const body=build(values, revision); const ok=await cabinet.adminWrite(body.path||'/api/command', body.payload||{...body, revision, requestKey:crypto.randomUUID()}); if(ok&&clear){ui.drafts.delete(id); render();}}catch{ui.error='Не удалось подготовить команду. Проверьте значения или JSON и обновите состояние.'; render();}}); host.append(f); return f;
}
function cmd(action, fields={}){return cabinet.adminWrite('/api/command',{action, revision:cabinet.state.data.revision, requestKey:crypto.randomUUID(),...fields});}
function snapshot(host, title, value){host.append(E('details',{},[E('summary',{text:title}), E('pre',{text:JSON.stringify(value, null, 2)})]));}
function header(state){
 const h=E('header',{class:'top'},[E('a',{class:'brand', href:'/', text:'QabylDesk'}), P(state.user?`${state.user.name} · ${state.user.role==='admin'?'Администратор':'Получатель'}`:'Кабинет синтетических пакетов','identity')]); root.append(h);
 if(state.user){const nav=E('div',{},[]); if(state.user.role==='admin'&&state.data)for(const [pane, name]of [['templates','Черновики'],['publications','Опубликовано'],['dispatches','Выдачи'],['access','Данные и доступ']]){const b=button(name,()=>{ui.pane=pane; ui.error=''; render();}); if(ui.pane===pane)b.setAttribute('aria-current','page'); nav.append(b);}
 else if(state.user.role==='operator'&&state.data)nav.append(button('Мои пакеты',()=>{ui.language=null; cabinet.select(null);}));
 nav.append(button('Обновить состояние',()=>cabinet.refresh(),'', state.busy), button('Выйти',()=>cabinet.logout())); root.append(E('nav',{class:'bar','aria-label':'Кабинет'}, nav));}
}
function login(main, state){
 const box=E('section',{class:'login'},[E('h1',{text:'Адресованные пакеты'}), P('Откройте выданный этому аккаунту синтетический текст и явно сохраните свою ручную отметку. Внешней почты и автоматических подтверждений нет.')]);
 const f=E('form',{id:'login'}), name=field(f,'username','Имя аккаунта',{max:80}), password=field(f,'password','Пароль',{type:'password', max:200}); name.autocomplete='username';
 f.append(E('button',{type:'submit', class:'primary', text:'Войти в кабинет', disabled:state.busy})); f.addEventListener('submit', event=>{event.preventDefault(); if(f.reportValidity())cabinet.login(name.value, password.value);}); box.append(f); main.append(box);
}
function recipient(main, state){
 main.append(E('h1',{text:'Мои пакеты'}), P('Здесь только выдачи вашему аккаунту. Ручная отметка не доказывает чтение, понимание или юридическое ознакомление.','intro'));
 const layout=E('div',{class:'correspondence'}), index=E('aside',{class:'packet-index','aria-label':'Адресованные пакеты'}, E('h2',{text:'Выдано этому аккаунту'})), list=E('ul');
 for(const p of state.data.packets){const b=button(p.content.title,()=>{ui.language=null; cabinet.select(p.id);},'packet-link'); if(p.id===state.selectedId)b.setAttribute('aria-current','true'); list.append(E('li',{},[b, E('small',{text:status(p.state)}), E('small',{text:'Выдано '+stamp(p.issuedAt)})]));}
 if(!state.data.packets.length)index.append(P('Доступных пакетов нет. Открытие страницы ничего не отмечает.','empty')); index.append(list); layout.append(index);
 const p=state.detail, letter=E('article',{class:'letter'});
 if(!p)letter.append(E('h2',{text:'Выберите адресованный пакет'}), P('Содержимое появится после проверки текущего сеанса и доступа на сервере. Выдача ещё не является вашей ручной отметкой.'));
 else{
  const language=ui.language||p.language; letter.append(E('h2',{text:p.content.title}), P(status(p.state),'status'));
  const metadata=E('dl',{class:'letter-meta'}); for(const [key, value]of [['Выдано', stamp(p.issuedAt)],['Версия содержания', p.content.version],['Версия выдачи', p.version],['Язык при выдаче', p.language==='kk'?'Қазақша':'Русский']])metadata.append(E('dt',{text:key}), E('dd',{text:value})); letter.append(metadata);
  const lang=E('select',{id:'display-language'},[E('option',{value:'ru', text:'Русский'}), E('option',{value:'kk', text:'Қазақша'})]); lang.value=language; lang.addEventListener('change',()=>{ui.language=lang.value; render();}); letter.append(E('label',{for:'display-language', text:'Язык текста на экране'}), lang);
  for(const s of p.content.sections)letter.append(E('section',{lang:language},[E('h3',{text:language==='kk'?s.titleKk:s.titleRu}), P(language==='kk'?s.textKk:s.textRu,'body-text')]));
  const manual=E('section',{class:'statement'}, E('h2',{text:p.state==='acknowledged'?'Сохранённая ручная отметка':'Ручная отметка аккаунта'}));
  if(p.acknowledgement)manual.append(P(p.acknowledgement.note,'body-text'), P(stamp(p.acknowledgement.at),'muted'), P('Отметка неизменна. Она не является электронной подписью или подтверждением внешней доставки.','helper'));
  else{
   const f=E('form',{id:'acknowledgement'}), note=field(f,'note','Основание ручной отметки',{type:'textarea', value:state.note, max:2000, help:'Обязательный авторский текст, до 2000 единиц UTF-16. Хранится в живой вкладке до явного сохранения; полная перезагрузка может его потерять.'}); note.addEventListener('input',()=>cabinet.setNote(note.value));
   f.append(P('Открытие, прокрутка и время не создают отметку. Получатель сам подтверждает действие; чтение человеком не проверяется.','helper'));
   f.append(E('div',{class:'actions'},[button('Проверить доступность версии',()=>{if(f.reportValidity())cabinet.preview();},'', state.busy), E('button',{type:'submit', id:'ack-submit', class:'primary', text:'Сохранить ручную отметку', disabled:state.busy||!state.preview||state.phase!=='ready'})]));
   if(state.preview)f.append(P('Предпросмотр доступности готов для версии выдачи '+state.preview.version+'. Он ничего не записал.','status'));
   f.addEventListener('submit', event=>{event.preventDefault(); if(f.reportValidity())cabinet.acknowledge();}); manual.append(f);
  }
  letter.append(manual);
 }
 layout.append(letter); main.append(layout);
}
function templates(main, state){
 const data=state.data.data; main.append(E('h1',{text:'Черновики пакетов'}), P('Авторские синтетические тексты RU/KK. Публикация замораживает версию, а выдача отдельно адресует её аккаунту.','intro'));
 adminForm(main,'template-new',[['code','Код шаблона',{max:40, help:'A–Z, цифры и _, начало с буквы. Код остаётся занят навсегда.'}],['title','Название',{max:200}]], v=>({action:'template.create',...v}),'Создать черновик');
 const list=E('ul',{class:'rows'}); for(const t of data.templates){const item=E('li',{},[button(`${t.code} · ${t.title}`,()=>{if(ui.template!==t.id)cabinet.clearAdminResult();ui.template=t.id; render();},'packet-link'), P(`Версия содержания ${t.version}${t.archived?' · Архив':''}`,'muted')]); list.append(item);}main.append(list);
 const t=data.templates.find(x=>x.id===ui.template); if(!t)return; main.append(E('h2',{text:t.code+' · '+t.title})); if(t.archived){main.append(P('Шаблон в архиве. Новые публикации и выдачи закрыты; прежние выдачи используют снимок.')); return;}
 adminForm(main,'template-edit-'+t.id,[['title','Название черновика',{value:t.title}]], v=>({action:'template.edit', templateId:t.id,...v}),'Сохранить название');
 main.append(E('h3',{text:'Разделы RU/KK'})); for(const section of t.sections){const d=E('details',{}, E('summary',{text:`Позиция ${section.position}: ${section.titleRu||'Без заголовка'}${section.archived?' · Архив':''}`})); if(section.archived)snapshot(d,'Исторические поля раздела', section); else{
  sectionForm(d, t, section); d.append(button('Архивировать раздел',()=>cmd('section.archive',{templateId:t.id, sectionId:section.id}),'', state.busy));}main.append(d);}
 if(t.sections.filter(s=>!s.archived).length<8){const add=E('details',{}, E('summary',{text:'Добавить раздел'})); sectionForm(add, t); main.append(add);}
 const publish=E('section',{class:'statement'},[E('h2',{text:'Опубликовать текущую версию'}), P('Нужны 1–8 полных двуязычных разделов с разными позициями 1–20. Та же версия не публикуется повторно, даже после архива.')]);
 const publicationCommand={action:'publish', templateId:t.id, revision:state.data.revision, requestKey:crypto.randomUUID()}; publish.append(button('Предпросмотр публикации',()=>cabinet.adminRead('/api/preview', publicationCommand),'', state.busy));
 const currentPreview=publicationPreviewFor(state.adminResult,t,state.data.revision);
 if(currentPreview){snapshot(publish,'Результат предпросмотра, не запись', currentPreview); publish.append(button('Опубликовать точную текущую версию',()=>{if(publicationPreviewFor(cabinet.state.adminResult,t,cabinet.state.data.revision))cmd('publish',{templateId:t.id});},'primary', state.busy));}
 publish.append(button('Архивировать шаблон',()=>cmd('template.archive',{templateId:t.id}),'', state.busy)); main.append(publish);
}
function sectionForm(host, t, s){const id='section-'+(s?.id||t.id+'-new'); adminForm(host, id,[['position','Позиция (1–20)',{value:s?.position||1, type:'number', max:2}],['titleRu','Заголовок RU',{value:s?.titleRu||'', required:false}],['titleKk','Тақырып KK',{value:s?.titleKk||'', required:false}],['textRu','Текст RU',{type:'textarea', value:s?.textRu||'', max:5000, required:false}],['textKk','Мәтін KK',{type:'textarea', value:s?.textKk||'', max:5000, required:false}]], v=>({action:'section.save', templateId:t.id, sectionId:s?.id||null,...v, position:Number(v.position)}),'Сохранить раздел');}
function publications(main, state){
 main.append(E('h1',{text:'Опубликованные версии'}), P('Неизменные авторские снимки. Архив закрывает только новые выдачи.','intro')); const data=state.data.data;
 for(const p of data.publications){const section=E('section',{},[E('h2',{text:p.content.title+` · версия ${p.content.version}`}), P(`${p.archived?'Архив · ':''}Автор ${p.author} · ${stamp(p.at)}`,'muted')]); snapshot(section,'Точный опубликованный состав', p.content); section.append(P('SHA256 '+p.digest,'helper'));
  if(!p.archived&&!data.templates.find(t=>t.id===p.templateId)?.archived){
   const users=(state.adminUsers||[]).filter(u=>u.role==='operator'); adminForm(section,'dispatch-'+p.id,[['recipient','Аккаунт получателя',{options:[{value:'', label:'Выберите получателя'},...users.map(u=>({value:u.name, label:u.name}))]}],['language','Язык при выдаче',{options:[{value:'ru', label:'Русский'},{value:'kk', label:'Қазақша'}]}]], v=>({action:'dispatch', publicationId:p.id,...v}),'Выдать пакет этому аккаунту'); section.append(button('Архивировать публикацию',()=>cmd('publication.archive',{publicationId:p.id}),'', state.busy));
  }else section.append(P('Новая выдача закрыта архивом публикации или шаблона. Прежние выдачи не изменены.','helper')); main.append(section);
 }
 if(!data.publications.length)main.append(P('Пока нет публикаций. Сначала заполните двуязычный черновик.','empty'));
}
function dispatches(main, state){
 const data=state.data.data; main.append(E('h1',{text:'Адресные выдачи'}), P('Выдача не означает внешнюю доставку. Только получатель сохраняет свою ручную отметку; администратор может отозвать ещё не отмеченную выдачу.','intro'));
 const views=E('div',{class:'actions'});for(const [history,label]of[[false,'Рабочие выдачи'],[true,'История всех выдач']]){const b=button(label,()=>{ui.showHistory=history;render();});b.setAttribute('aria-pressed',String(ui.showHistory===history));views.append(b);}main.append(views);
 const rows=adminDispatchRows(data.dispatches,ui.showHistory),layout=E('div',{class:'correspondence'}), index=E('aside',{class:'packet-index'}, E('h2',{text:ui.showHistory?'История всех выдач':'Рабочие выдачи'})), list=E('ul');
 for(const d of rows){const b=button(`${d.recipient} · ${d.snapshot.title}`,()=>{ui.dispatch=d.id; render();},'packet-link'); if(d.id===ui.dispatch)b.setAttribute('aria-current','true'); list.append(E('li',{},[b, E('small',{text:status(d.state)+(d.adminArchived?' · В архиве администратора':'')})]));}if(!rows.length)index.append(P('В этом списке нет выдач. Все сохранённые записи доступны в истории.','empty'));index.append(list); layout.append(index);
 const row=rows.find(x=>x.id===ui.dispatch), letter=E('article',{class:'letter'});
 if(!row)letter.append(E('h2',{text:'Выберите выдачу'}), P('Администратор видит все синтетические выдачи и сохраняет историю отзыва. Получатель видит только адресованные ему доступные или отмеченные пакеты.'));
 else{
  letter.append(E('h2',{text:row.snapshot.title}), P(status(row.state),'status'), P(`Получатель ${row.recipient} · Выдал ${row.issuedBy} · ${stamp(row.issuedAt)}`), P(`Версия содержания ${row.snapshot.version} · Версия выдачи ${row.version}`,'muted')); snapshot(letter,'Точный выданный текст', row.snapshot);
  const terminal=data.terminals.find(x=>x.dispatchId===row.id); if(terminal){letter.append(E('h3',{text:terminal.kind==='acknowledged'?'Ручная отметка аккаунта':'Основание отзыва'}), P(terminal.note,'body-text'), P(terminal.actor+' · '+stamp(terminal.at),'muted')); if(!row.adminArchived)letter.append(button('Скрыть в рабочем списке администратора',()=>cmd('dispatch.archive',{dispatchUUID:row.id}),'', state.busy));}
  else adminForm(letter,'withdraw-'+row.id,[['note','Основание явного отзыва',{type:'textarea', max:2000, help:'После отзыва получатель не читает этот пакет. Ранее скопированное знание не удаляется.'}]], v=>({action:'withdraw', dispatchUUID:row.id, expectedVersion:row.version,...v}),'Отозвать неотмеченную выдачу');
 }
 layout.append(letter); main.append(layout);
}
function access(main, state){
 main.append(E('h1',{text:'Данные и доступ'}), P('Новые аккаунты только для синтетического локального процесса. Удаления, переименования и изменения роли существующего аккаунта в0.1 нет.'));
 const list=E('ul'); for(const u of state.adminUsers||[])list.append(E('li',{text:u.name+' · '+(u.role==='admin'?'Администратор':'Получатель')})); main.append(list);
 adminForm(main,'new-user',[['username','Новое имя аккаунта',{max:80}],['password','Новый пароль',{type:'password', max:200, help:'14–200 символов. Не используйте настоящие пароли в синтетическом показе.'}],['role','Роль',{options:[{value:'operator', label:'Получатель'},{value:'admin', label:'Администратор'}]}]], v=>({path:'/api/users', payload:v}),'Создать синтетический аккаунт');
 main.append(E('h2',{text:'JSON-копия предметной области'}), P('Без аккаунтов, паролей, сеансов и аудита. Восстановление только в пустую область с заранее созданными текущими аккаунтами/ролями. Подписи нет; согласованность не доказывает подлинность. Полная согласованная SQLite-копия создаётся отдельно.'));
 main.append(E('div',{class:'actions'},[button('Прочитать JSON-копию',()=>cabinet.adminRead('/api/backup'),'', state.busy), button('Прочитать последние события аудита',()=>cabinet.adminRead('/api/audit'),'', state.busy)]));
 if(state.adminResult&&['/api/backup','/api/audit'].includes(state.adminResult.path))snapshot(main, state.adminResult.path==='/api/backup'?'JSON-копия для явного копирования':'События аудита', state.adminResult.result);
 const restore=E('details',{}, E('summary',{text:'Восстановление в пустую область'})); adminForm(restore,'restore',[['backup','Полный JSON-код копии',{type:'textarea', max:2097152}]],(v, revision)=>({path:'/api/restore', payload:{backup:JSON.parse(v.backup), revision, requestKey:crypto.randomUUID()}}),'Восстановить в пустую область'); main.append(restore);
}
function render(){
 const activeId=document.activeElement?.id; controlSeq=0; const s=cabinet.state, key=s.user?s.user.name+':'+s.user.role:null, identityChanged=ui.identity!==key; if(identityChanged){resetUI(); ui.identity=key;}root.replaceChildren(); header(s); const main=E('main',{id:'main'});
 if(s.error)main.append(E('div',{class:'error', role:'alert', tabindex:'-1', text:s.error})); if(ui.error)main.append(E('div',{class:'error', role:'alert', text:ui.error})); if(s.notice)main.append(E('div',{class:'notice', role:'status', tabindex:'-1', text:s.notice}));
 if(s.phase==='login')login(main, s);
 else if(['checking','hidden'].includes(s.phase))main.append(E('h1',{text:s.phase==='hidden'?'Содержимое временно скрыто':'Проверяем текущий сеанс'}), P('Доступ и аккаунт проверяются до показа пакетов. Никакие отметки автоматически не сохраняются.','busy'));
 else if(s.phase==='unknown')main.append(E('h1',{text:'Результат записи неизвестен'}), P('Используйте «Обновить состояние». Новая команда автоматически не отправляется. Текущий снимок скрыт до перечитывания.'));
 else if(s.phase==='unavailable')main.append(E('h1',{text:'Пакет недоступен'}), P('Весь прежний текст пакета скрыт. Это не новая ручная отметка.'));
 else if(!s.data)main.append(E('h1',{text:'Нужно обновить состояние'}), P('Текущие данные не подтверждены. Проверьте сеанс и доступ перед действием.'));
 else if(s.user.role==='operator')recipient(main, s); else ({templates, publications, dispatches, access})[ui.pane](main, s);
 if(s.orphanNote){const copy=E('section',{class:'statement'}, E('h2',{text:'Несохранённое основание для копирования'})); field(copy,'orphan','Только ваш текст',{type:'textarea', value:s.orphanNote, required:false, max:2000}); const input=copy.querySelector('textarea'); input.readOnly=true; main.append(copy, P('Этот текст не является сохранённой отметкой и не включает недоступное содержимое пакета.','helper'));}
 if(s.busy)main.append(P('Запрос выполняется…','busy')); root.append(main, E('footer',{}, P('QabylDesk 0.1 · Только вымышленные тексты. Ручная отметка аккаунта не является электронной подписью, доказательством чтения или внешней доставки. Администратор видит всё; полная изоляция организаций не заявлена.')));
 if(s.error&&s.error!==ui.lastError)main.querySelector('[role=alert]')?.focus();else if(s.notice&&s.notice!==ui.lastNotice)main.querySelector('[role=status]')?.focus();else if(!identityChanged&&activeId&&!['checking','hidden'].includes(s.phase))document.getElementById(activeId)?.focus({preventScroll:true});ui.lastError=s.error;ui.lastNotice=s.notice;
}
window.addEventListener('pagehide',()=>cabinet.hide()); window.addEventListener('pageshow', event=>{if(event.persisted)cabinet.refresh();}); document.addEventListener('visibilitychange',()=>{if(document.hidden)cabinet.hide(); else cabinet.refresh();});
render(); cabinet.refresh();
