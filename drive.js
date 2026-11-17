(() => {
 'use strict';
 const cfg=window.REPORT_DRIVE||{};
 let busy=false;
 function endpoint(){try{const u=new URL(cfg.webAppUrl);return u.protocol==='https:'&&u.hostname==='script.google.com'&&/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)?u:null;}catch{return null;}}
 function status(text,type=''){const retry=document.getElementById('save-drive');if(retry)retry.hidden=type!=='error';const el=document.getElementById('drive-status');if(el){el.textContent=text;el.className='email-status '+type;}}
 function button(value){busy=value;const el=document.getElementById('save-drive');if(el){el.disabled=value||!endpoint();el.textContent=value?'Збереження…':'Повторити збереження';}}
 function requestId(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');}
 function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
 function receipt(id,sendAttempt){
  return new Promise((resolve,reject)=>{
   const callback='__pr6Receipt_'+requestId(),script=document.createElement('script'),u=endpoint();
   if(!u){reject(Error('CONFIG'));return;}
   const cleanup=()=>{clearTimeout(timer);script.remove();delete window[callback];};
   window[callback]=value=>{cleanup();if(!value||value.requestId!==id||!['saved','pending','error'].includes(value.status)){reject(Error('RECEIPT'));return;}resolve(value);};
   script.onerror=()=>{cleanup();reject(Error('NETWORK'));};
   const timer=setTimeout(()=>{cleanup();reject(Error('TIMEOUT'));},8000);
   u.searchParams.set('action','status');u.searchParams.set('requestId',id);u.searchParams.set('attempt',sendAttempt);u.searchParams.set('callback',callback);u.searchParams.set('_',String(Date.now()));
   script.src=u.href;script.referrerPolicy='no-referrer';document.head.append(script);
  });
 }
 function errorText(code){return {SIZE:'Обсяг записів перевищує ліміт приймача. Повідомте викладача.',VALIDATION:'Приймач не прийняв структуру звіту. Перевірте заповнення та відповідність версії завдання.',ANSWERS:'Приймач не підтвердив усі фінальні відповіді. Повторно перевірте кроки.',BUSY:'Приймач зайнятий. Спробуйте ще раз — той самий номер здавання не створить дубліката.',CONFLICT:'Цей номер здавання пов’язаний з іншим вмістом. Повідомте викладача.',DAILY_LIMIT:'Сьогодні досягнуто ліміту приймача. Повідомте викладача.',STORAGE:'Не підтверджено доступ до папки. Викладачеві потрібно перевірити приймач.'}[code]||'Не вдалося підтвердити збереження. Повідомте викладача.';}
 async function submit(){
  if(busy||!endpoint())return;
  const api=window.PR_REPORT;if(!api||!api.ready())return;
  if(!api.identityReady()){status('Заповніть ПІБ і групу вгорі сторінки, потім повторіть збереження.','error');return;}
  button(true);
  try{
   const snapshot=api.snapshot(),id=api.requestId();
   // Повторна здача користується тим самим номером. Сервер перевіряє дублікати.
   const sendAttempt=requestId();
   const payload=JSON.stringify({protocol:'pr6-drive-v1',requestId:id,attempt:sendAttempt,snapshot});
   if(payload.length>(cfg.maxRequestChars||200000)){status(errorText('SIZE'),'error');return;}
   status('Передаємо роботу й очікуємо підтвердження створення файла…');
   const controller=new AbortController(),postTimer=setTimeout(()=>controller.abort(),20000);
   // Opaque-відповідь не є підтвердженням. Після POST окремо читаємо квитанцію.
   fetch(endpoint().href,{method:'POST',mode:'no-cors',credentials:'omit',referrerPolicy:'no-referrer',body:new URLSearchParams({payload}),signal:controller.signal}).catch(()=>{}).finally(()=>clearTimeout(postTimer));
   let result=null;
   for(let attempt=0;attempt<8;attempt++){
    await wait(attempt===0?1500:2500);
    try{const value=await receipt(id,sendAttempt);if(value.status==='saved'||value.status==='error'){result=value;break;}}catch{}
   }
   if(result&&result.status==='saved'){
    queueMicrotask(()=>document.dispatchEvent(new CustomEvent('pr:saved')));
    status('Роботу здано: створення файла на Google Диску підтверджено. Номер здавання: '+id+'. Власну копію звіту можна завантажити нижче.','success');
   }else if(result&&result.status==='error')status(errorText(result.code),'error');
   else status('Підтвердження поки не отримано. Файл міг зберегтися. Натисніть кнопку повторно: для цього вмісту використовується той самий номер здавання.','error');
  }catch{status('Не вдалося підтвердити збереження. Перевірте інтернет.','error');}
  finally{button(false);}
 }
 document.addEventListener('pr:summary',e=>{
  if(!window.PR_REPORT.pending())return;
  const summary=document.getElementById('summary-content');
  const panel=document.createElement('div');panel.className='email-panel';
  const feedback=document.createElement('p');feedback.id='drive-status';feedback.setAttribute('role','status');panel.append(feedback);
  const btn=document.createElement('button');btn.type='button';btn.id='save-drive';btn.className='button';btn.textContent='Повторити збереження';btn.hidden=true;btn.addEventListener('click',submit);panel.append(btn);
  summary.insertBefore(panel,summary.querySelector('.actions'));
  if(!endpoint()){status('Збереження ще не налаштовано. Зверніться до викладача.');return;}
  if(busy){status('Збереження триває…');return;}
  if(e.detail.autoSend){submit();return;}
  status('Натисніть, щоб повторити збереження.','error');
 });
})();
