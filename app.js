(() => {
 'use strict';
 const course=window.COURSE, key='print-lab-pr06:'+course.version;
 const $=id=>document.getElementById(id);
 const editable = el => el instanceof Element && !!el.closest('textarea,input,[contenteditable="true"]');
 document.addEventListener('copy',e=>{
  if(!editable(e.target))e.preventDefault();
 });
 document.addEventListener('selectstart',e=>{if(!editable(e.target))e.preventDefault();});
 document.addEventListener('contextmenu',e=>{if(!editable(e.target))e.preventDefault();});
 document.addEventListener('dragstart',e=>{if(!editable(e.target))e.preventDefault();});

 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fresh=()=>({version:course.version,name:'',group:'',current:0,finalized:false,submitted:false,steps:course.steps.map(()=>({notes:'',answers:Array(5).fill(''),checks:0,first:null,last:null,passed:false})),updated:null});
 let state=fresh(),storageOK=true,summary=false;
 try{
  const raw=localStorage.getItem(key);
  if(raw){const s=JSON.parse(raw);if(validState(s)) state=s;else $('notice').textContent='Попередній запис не вдалося відновити. Починаємо новий прохід.';}
 }catch{storageOK=false;}
 function validState(s){return s&&s.version===course.version&&typeof s.name==='string'&&typeof s.group==='string'&&Number.isInteger(s.current)&&s.current>=0&&s.current<10&&Array.isArray(s.steps)&&s.steps.length===10&&s.steps.every(x=>x&&typeof x.notes==='string'&&Array.isArray(x.answers)&&x.answers.length===5&&x.answers.every(a=>typeof a==='string'||Number.isInteger(a))&&Number.isInteger(x.checks)&&x.checks>=0&&(x.first===null||Number.isInteger(x.first)&&x.first>=0&&x.first<=5)&&(x.last===null||Number.isInteger(x.last)&&x.last>=0&&x.last<=5)&&typeof x.passed==='boolean');}
 function visibilitySummary(){
  const v=state.visibility;
  return v?{hiddenCount:v.hiddenCount,hiddenMs:v.hiddenMs}:null;
 }
 function trackVisibility(finish=false){
  if(state.finalized)return;
  if(!state.visibility&&state.steps.some(s=>s.notes.trim()||s.answers.some(a=>a!=='')))state.visibility={hiddenCount:0,hiddenMs:0,hiddenSince:null};
  const v=state.visibility;
  if(!v)return;
  const now=Date.now();
  if(finish||document.visibilityState==='visible'){
   if(v.hiddenSince!==null)v.hiddenMs+=Math.max(0,now-v.hiddenSince);
   v.hiddenSince=null;
  }else if(document.visibilityState==='hidden'&&v.hiddenSince===null){v.hiddenSince=now;v.hiddenCount++;}
 }
 function save(){trackVisibility();state.updated=new Date().toISOString();try{localStorage.setItem(key,JSON.stringify(state));storageOK=true;}catch{storageOK=false;} $('save-status').textContent=storageOK?'Збережено на цьому пристрої':'Автозбереження недоступне. Не закривайте вкладку до здавання.';}
 function unlocked(){const i=state.steps.findIndex(x=>!x.passed);return i<0?9:i;}
 function count(){return state.steps.filter(x=>x.passed).length;}
 function numberValue(a){const s=String(a).trim().replace(/\s/g,'').replace(',','.').replace(/^−/,'-');return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)?Number(s):NaN;}
 function correct(q,a){return q.type==='number'?Number.isFinite(numberValue(a))&&Math.abs(numberValue(a)-q.answer)<=q.tolerance+1e-9:Number(a)===q.answer&&a!=='';}
 function nav(){
  const done=count();$('progress').value=done;$('progress-label').textContent=`${done} із 10 кроків`;$('progress-percent').textContent=`${done*10} %`;
  $('step-nav').innerHTML=course.steps.map((x,i)=>`<button type="button" data-step="${i}" class="nav-step ${state.steps[i].passed?'done':''} ${!summary&&state.current===i?'current':''}" ${i>unlocked()||state.finalized?'disabled':''} ${!summary&&state.current===i?'aria-current="step"':''}><span class="index">${state.steps[i].passed?'✓':String(i+1).padStart(2,'0')}</span><span>${esc(x.title)}</span></button>`).join('');
  $('step-nav').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.step))));
  $('summary-button').disabled=done!==10;
 }
 function diagram(step){
  return `<ol class="operation-flow" aria-label="Схема операцій">${step.diagram.map(label=>`<li>${esc(label)}</li>`).join('')}</ol>`;
 }
 function question(q,i,s){const answer=s.answers[i];return `<fieldset class="question" id="question-${i}"><legend><span class="qno">ЗАПИТАННЯ ${i+1} / 5</span>${esc(q.text)}</legend>${q.type==='number'?`<div class="numeric"><input aria-label="Відповідь на запитання ${i+1}, ${esc(q.unit)}" type="text" inputmode="${q.answer<0?'text':'decimal'}" autocomplete="off" data-question="${i}" value="${esc(answer)}" maxlength="32" placeholder="Введіть число"><span>${esc(q.unit)}</span></div>`:`<div class="answers">${q.options.map((o,j)=>`<label class="option"><input type="radio" name="question-${i}" value="${j}" data-question="${i}" ${String(answer)===String(j)?'checked':''}><span>${esc(o)}</span></label>`).join('')}</div>`}<p class="feedback" hidden></p></fieldset>`;}
 function renderStep(){
  if(state.finalized){renderSummary(false);return;}
  summary=false;$('summary-content').hidden=true;$('step-content').hidden=false;
  const n=state.current, step=course.steps[n],s=state.steps[n];
  $('step-content').innerHTML=`<div class="step-heading"><span class="counter">КРОК ${String(n+1).padStart(2,'0')} / 10</span><span class="tag">${esc(step.tag)} · ≈ ${step.minutes} хв</span></div><h2 class="step-title" tabindex="-1">${esc(step.title)}</h2><p class="step-intro">${esc(step.intro)}</p><section class="theory" aria-label="Пояснення та вихідні дані"><h3 class="section-kicker">Пояснення та вихідні дані</h3>${step.theory.map(t=>`<p>${esc(t)}</p>`).join('')}</section>${diagram(step)}<section class="task"><h3>Ваше рішення</h3><p id="task-prompt">${esc(step.task)}</p><label for="step-notes">Запис для звіту</label><textarea id="step-notes" aria-describedby="task-prompt" placeholder="Запишіть рішення, формули та пояснення…" maxlength="12000">${esc(s.notes)}</textarea><div class="hint">Зміст цього запису оцінює викладач. Тести нижче перевіряють розуміння умов.</div></section><form id="quiz-form" novalidate><div class="quiz-heading"><h3>Перевірка рішення</h3><span>5 запитань</span></div><p class="hint">Числові відповіді вводьте без одиниць, із комою або крапкою.</p>${step.questions.map((q,i)=>question(q,i,s)).join('')}<div id="check-status" role="status" aria-live="polite" ${s.last===null?'hidden':''} class="check-status"></div><div class="actions"><button class="button" type="submit">${n===9?'Завершити перевірку та здати роботу':'Перевірити відповіді'}</button><button class="button secondary" type="button" id="next-button" ${s.passed?'':'disabled'}>${n===9?('Завершити й здати роботу'):'Наступний крок →'}</button>${n>0?'<button type="button" id="previous-button" class="button secondary">← Назад</button>':''}</div></form>`;
  $('step-notes').addEventListener('input',e=>{s.notes=e.target.value;if(!s.notes.trim())invalidate();save();});
  $('quiz-form').querySelectorAll('input[data-question]').forEach(input=>input.addEventListener('input',e=>{const i=Number(e.target.dataset.question);s.answers[i]=e.target.value;invalidate(i);save();}));
  $('quiz-form').addEventListener('submit',e=>{e.preventDefault();check();});
  $('next-button').addEventListener('click',()=>{if(!s.passed)return;if(n===9)finalize();else go(n+1);});
  if(n>0)$('previous-button').addEventListener('click',()=>go(n-1));
  if(s.last!==null)showResults(true);
  nav();
 }
 function invalidate(i){
  const s=state.steps[state.current];s.passed=false;
  // A modified checkpoint must be checked again. Later work remains saved.
  $('next-button').disabled=true;
  if(i!==undefined){const q=$('question-'+i);q.classList.remove('correct','incorrect');q.querySelector('.feedback').hidden=true;}
  const status=$('check-status');status.hidden=false;status.className='check-status';status.textContent='Відповіді змінено. Перевірте цей крок повторно, щоб продовжити.';nav();
 }
 function check(){
  if(state.finalized)return;
  const n=state.current,s=state.steps[n],step=course.steps[n];
  
  const missing=s.answers.findIndex((a,i)=>String(a).trim()===''||(step.questions[i].type==='number'&&!Number.isFinite(numberValue(a))));
  if(!s.notes.trim()){message('Спочатку запишіть своє рішення для звіту.');$('step-notes').focus();return;}
  if(missing>=0){message(`Дайте коректну відповідь на запитання ${missing+1}. У числовому полі потрібне лише число.`);$('question-'+missing).querySelector('input').focus();return;}
  const score=step.questions.reduce((a,q,i)=>a+Number(correct(q,s.answers[i])),0);
  s.checks++;if(s.first===null)s.first=score;s.last=score;s.passed=score===5;
  if(s.passed&&count()===10&&finalize())return;
  save();showResults(true);nav();
  $('check-status').scrollIntoView({block:'center',behavior:'auto'});
 }
 function message(text){const el=$('check-status');el.hidden=false;el.className='check-status error';el.textContent=text;}
 function showResults(showFeedback){
  const s=state.steps[state.current],step=course.steps[state.current];
  if(showFeedback)step.questions.forEach((q,i)=>{const ok=correct(q,s.answers[i]),el=$('question-'+i);el.classList.toggle('correct',ok);el.classList.toggle('incorrect',!ok);const f=el.querySelector('.feedback');f.hidden=false;f.textContent=(ok?'✓ Правильно. ':'↻ Потрібно виправити. ')+q.explain;});
  const status=$('check-status');status.hidden=false;status.className='check-status'+(s.passed?'':' error');
  status.textContent=s.passed?`Крок завершено: 5 із 5. Перша перевірка: ${s.first}/5. Перевірок: ${s.checks}. Запис додано до звіту.`:`Остання перевірка: ${s.last}/5. Прочитайте пояснення й виправте відповіді. Для переходу потрібно 5 із 5 та запис власного рішення. Перша перевірка: ${s.first}/5.`;
  $('next-button').disabled=!s.passed;
 }
 function go(n){if(state.finalized||n>unlocked())return;state.current=n;save();renderStep();const heading=document.querySelector('.step-title');heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:'auto'});}
 function finalize(){
  if(state.finalized||count()!==10||!identityReady())return false;
  trackVisibility(true);
  state.finalized=true;
  state.requestId=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  save();freezeIdentity();renderSummary(true);return true;
 }
 function renderSummary(autoSend=false){
  if(count()!==10||!state.finalized)return;summary=true;$('step-content').replaceChildren();$('step-content').hidden=true;$('summary-content').hidden=false;
  if(state.finalized&&!state.submitted){
   $('summary-content').innerHTML='<div class="summary-hero"><h2>Роботу завершено.</h2><p>Відповіді зафіксовано. Автоматично зберігаємо звіт викладачеві. Результат з’явиться після підтвердження збереження.</p></div><div class="actions"></div>';
   nav();$('summary-content').scrollIntoView({block:'start'});document.dispatchEvent(new CustomEvent('pr:summary',{detail:{autoSend:autoSend===true}}));return;
  }
  const initial=state.steps.reduce((a,s)=>a+(s.first||0),0),checks=state.steps.reduce((a,s)=>a+s.checks,0);
  $('summary-content').innerHTML=`<div class="summary-hero"><p class="section-kicker" style="color:#d4e8ba">ПРОЄКТ ЗАВЕРШЕНО</p><h2>Карту запуску підготовлено.</h2><p>Роботу збережено викладачеві. Відповіді зафіксовано.</p></div><div class="stats"><div class="stat"><b>${initial}/50</b><span>Правильних відповідей під час перших перевірок</span></div><div class="stat"><b>50/50</b><span>Підсумкове опрацювання після виправлень</span></div><div class="stat"><b>${checks}</b><span>Перевірок за весь прохід</span></div></div><p class="summary-note">Це навчальний тренажер із повторними спробами. Перша перевірка й підсумкове опрацювання — різні показники. Якість карти запуску та пояснень оцінює викладач; автоматичну оцінку за 12-бальною шкалою сайт не виставляє.</p>`;
  nav();$('summary-content').scrollIntoView({block:'start'});
 }
 function identityReady(){if(!$('student-name').value.trim()||!$('student-group').value.trim()){$('notice').textContent='Для здавання заповніть ПІБ і групу.';(!$('student-name').value.trim()?$('student-name'):$('student-group')).focus();return false;}$('notice').textContent='';return true;}
 $('student-name').value=state.name;$('student-group').value=state.group;
 $('student-name').addEventListener('input',e=>{if(state.finalized)return;state.name=e.target.value;save();});$('student-group').addEventListener('input',e=>{if(state.finalized)return;state.group=e.target.value;save();});
 $('summary-button').textContent='↗ Підсумок';
 $('summary-button').addEventListener('click',()=>state.finalized?renderSummary(false):finalize());

 window.PR_REPORT={identityReady,ready:()=>state.finalized&&count()===10,requestId:()=>state.requestId,pending:()=>state.finalized&&!state.submitted,snapshot:()=>({version:course.version,name:state.name,group:state.group,steps:state.steps,...(state.visibility?{visibility:visibilitySummary()}: {})})};
 function freezeIdentity(){$('student-name').disabled=!!state.finalized;$('student-group').disabled=!!state.finalized;}
 document.addEventListener('pr:saved',()=>{if(!state.finalized)return;state.submitted=true;save();freezeIdentity();renderSummary(false);});
 freezeIdentity();
 if(!state.finalized){save();document.addEventListener('visibilitychange',()=>{if(!state.finalized)save();});}
 state.current=Math.min(state.current,unlocked());
 if(state.finalized)document.addEventListener('DOMContentLoaded',()=>renderSummary(!state.submitted),{once:true});else renderStep();
 if(!storageOK)$('save-status').textContent='Автозбереження недоступне. Не закривайте вкладку до здавання.';
})();
