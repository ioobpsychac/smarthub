/* Orbit SmartHub: fixed-condition sites with configured completion delivery. */
(() => {
  'use strict';
  const D = window.STUDY_DATA, Q = window.QUESTIONNAIRES;
  const C=window.ORBIT_CONFIG, I=window.ORBIT_INTEGRATION;
  const VERSION=7, params=new URLSearchParams(location.search);
  const qualtricsId=I.participant(location.search);
  const KEY=C.siteId==='preview'&&!qualtricsId?'orbit-study-v4':`orbit-study-${C.mode}-${C.siteId}-${qualtricsId||'preview'}`;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const randomInt = n => {
    const a = new Uint32Array(1), limit = Math.floor(4294967296 / n) * n;
    do { crypto.getRandomValues(a); } while (a[0] >= limit);
    return a[0] % n;
  };
  const shuffle = a => { a = [...a]; for(let i=a.length-1;i>0;i--) {const j=randomInt(i+1); [a[i],a[j]]=[a[j],a[i]];} return a; };
  // Optional biography permutation indices support an external counterbalancing schedule.
  function permutation(index) {
    const pool=[0,1,2,3,4], result=[];
    for(let n=5;n>0;n--) {const f=[1,1,2,6,24][n-1]; const i=Math.floor(index/f); result.push(pool.splice(i,1)[0]); index%=f;}
    return result;
  }
  function assignment(key) {
    const raw=params.get(key);
    return raw!==null && /^\d+$/.test(raw) && Number(raw)<120 ? permutation(Number(raw)) : shuffle([0,1,2,3,4]);
  }
  const conditionParam=C.fixedCondition || (/^[1-4]$/.test(params.get('c')||'')?Number(params.get('c')):null);
  const freshState = () => ({version:VERSION, condition:I.condition(C,location.search,()=>randomInt(4)+1),
    qualtricsId,isTest:params.get('test')==='1'||/^R_TEST_/.test(qualtricsId||''),sessionId:crypto.randomUUID(),startedAt:new Date().toISOString(),completedAt:null,
    practiceReplies:[],presented:[],submission:null,
    bios:assignment('b'), stage:'welcome', visited:[], nextEmail:0,
    qPage:{q1:0,q2:0,q3:0}, answers:{q1:{},q2:{},q3:{}}, skipped:{q1:[],q2:[],q3:[]}, reviewed:{}, feedbackScroll:0});
  let state;
  try {
    state=JSON.parse(sessionStorage.getItem(KEY));
    // Preserve in-progress previews while replacing the old random photo mapping.
    if(state && [4,5].includes(state.version)) {
      state.version=6;delete state.photos;delete state.scenarioRead;
      state.skipped={q1:[],q2:[],q3:[]};state.reviewed={};state.feedbackScroll=0;
      // Revised question order starts at its first page for any in-progress questionnaire.
      state.qPage={q1:0,q2:0,q3:0};
      Object.keys(state.answers.q3).filter(id=>id.startsWith('emotion_')).forEach(id=>{state.answers.q2[id]=state.answers.q3[id];delete state.answers.q3[id];});
      if(state.stage==='scenario')state.stage='feedback';
      if(state.stage==='apology')state.stage='apologyIntro';
    }
    if(state?.version===6) {
      state.version=VERSION;state.qualtricsId=qualtricsId;state.sessionId=crypto.randomUUID();
      state.startedAt=null;state.completedAt=null;state.practiceReplies=[];state.presented=[];state.submission=null;
    }
    if(!state || state.version!==VERSION || (conditionParam && state.condition!==conditionParam) || params.get('new')==='1') state=freshState();
  } catch { state=freshState(); }
  if(params.has('new')) {params.delete('new');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);}
  function save() { try {sessionStorage.setItem(KEY,JSON.stringify(state));} catch {showStorageWarning();} }
  function showStorageWarning() {
    if($('storage-warning'))return;
    const el=document.createElement('div');el.id='storage-warning';el.className='review-note';el.style.cssText='position:fixed;bottom:0;right:0;z-index:1100;max-width:480px';
    el.textContent='This browser cannot keep your progress. Leave this tab open while you work; refreshing may reset the simulation.';document.body.append(el);
  }
  const workspace=$('workspace'), overlay=$('tourOverlay'), sparky=$('sparky'), modal=$('modal-root');
  const dashboard = workspace.innerHTML;
  let target=null, navAction=null, modalReturnFocus=null;
  function biographyFor(text, pronouns) {
    const feminine=pronouns==='she/her', subject=feminine?'She':'He', object=feminine?'her':'him', possessive=feminine?'her':'his';
    return text.replace(/\bThey have\b/g,subject+' has')
      .replace(/\bThey are\b/g,subject+' is')
      .replace(/\bThey (support|handle|specialize)\b/g,(_,verb)=>subject+' '+verb+'s')
      .replace(/\band hold\b/g,'and holds')
      .replace(/\bTheir\b/g,feminine?'Her':'His').replace(/\btheir\b/g,possessive)
      .replace(/\bthem\b/g,object);
  }
  function person(id) {
    const i=D.people.findIndex(p=>p.id===id),p=D.people[i];let mentions=0;
    const bio=biographyFor(D.bios[state.bios[i]],p.pronouns).replaceAll('[Employee name]',()=>mentions++===0?p.name:p.name.split(' ')[0]);
    return {...p,bio};
  }
  function portrait(id, extra='') {
    const p=person(id), initials=p.name.split(' ').map(s=>s[0]).join('');
    return p.photo ? `<img class="portrait ${extra}" src="${p.photo}" alt="${esc(p.name)}" width="70" height="70">` : `<span class="portrait ${extra}" role="img" aria-label="${esc(p.name)}">${initials}</span>`;
  }
  // Convert the existing sidebar controls to keyboard-accessible buttons, preserving layout.
  document.querySelectorAll('.sidebar-item').forEach(old => {
    const b=document.createElement('button'); b.className=old.className;b.id=old.id;b.type='button';b.innerHTML=old.innerHTML;
    b.setAttribute('aria-disabled','true'); b.tabIndex=-1;old.replaceWith(b);
    b.addEventListener('click',()=>{if(navAction?.id===b.id)navAction.action();});
  });
  function selectNav(id) {document.querySelectorAll('.sidebar-item').forEach(b=>{b.classList.toggle('active',b.id===id);b.classList.remove('tour-target');b.setAttribute('aria-disabled','true');b.tabIndex=-1;});navAction=null;}
  function enableNav(id, action) {navAction={id,action};$(id).classList.add('tour-target');$(id).setAttribute('aria-disabled','false');$(id).tabIndex=0;}
  function topbar(title,sub) {return `<div class="topbar"><span class="topbar-title">${esc(title)}</span><span class="topbar-sep">/</span><span class="topbar-sub">${esc(sub)}</span></div>`;}
  function page(title,sub,body) {workspace.innerHTML=topbar(title,sub)+`<div class="workspace-body">${body}</div>`;}
  function go(stage) {state.stage=stage;save();render();}
  function updateOverlay() {
    const w=innerWidth,h=innerHeight;let path=`M0 0H${w}V${h}H0Z`;
    if(target && target.isConnected) {
      const r=target.getBoundingClientRect();const x=Math.max(0,r.left),y=Math.max(0,r.top),right=Math.min(w,r.right),bottom=Math.min(h,r.bottom);
      if(right>x && bottom>y)path+=`M${x} ${y}H${right}V${bottom}H${x}Z`;
    }
    overlay.setAttribute('viewBox',`0 0 ${w} ${h}`);$('tourShade').setAttribute('d',path);
  }
  function shade(el=null) {target=el;el?.scrollIntoView({block:'nearest',inline:'nearest'});overlay.classList.add('active');updateOverlay();}
  function clearGuide() {
    if(sparky.parentElement!==document.body)document.body.append(sparky);
    target=null;overlay.classList.remove('active');sparky.className='hidden';$('sparky-btn').onclick=null;
    $('sparky-bubble').setAttribute('role','dialog');
  }
  function guide(text,label,action,spot=null,position='center') {
    shade(spot);sparky.className=position==='corner'?'guide-corner':position==='bottom'?'guide-bottom':'';
    $('sparky-text').textContent=text;const b=$('sparky-btn');b.textContent=label||'';b.hidden=!label;b.style.display=label?'':'none';b.onclick=action;
    (label?b:spot)?.focus({preventScroll:true});
  }
  window.addEventListener('resize',updateOverlay);window.addEventListener('scroll',updateOverlay,true);
  const observer=new ResizeObserver(()=>{if(overlay.classList.contains('active'))updateOverlay();});observer.observe(workspace);observer.observe($('sidebar'));
  // Keep dimmed content unavailable to pointer and keyboard interaction.
  document.addEventListener('click',e=>{
    if(modal.children.length) {if(!modal.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}return;}
    if(overlay.classList.contains('active') && !sparky.contains(e.target) && !target?.contains(e.target) && e.target!==$('stop-study')) {e.preventDefault();e.stopImmediatePropagation();}
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    let scope=modal.children.length?modal:overlay.classList.contains('active')?sparky:null;
    if(!scope)return;
    let list=[...scope.querySelectorAll('button:not([disabled]),input,textarea,a[href]')].filter(x=>!x.hidden&&x.getClientRects().length);
    if(scope===sparky){if(target?.matches('button'))list.push(target);list.push($('stop-study'));}
    if(!list.length)return;
    const index=list.indexOf(document.activeElement), next=e.shiftKey?(index<=0?list.length-1:index-1):(index+1)%list.length;
    e.preventDefault();list[next].focus();
  });
  function modalOpen(content) {modalReturnFocus=document.activeElement;modal.innerHTML=`<div class="modal-backdrop"><section class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${content}</section></div>`;workspace.inert=true;$('sidebar').inert=true;modal.querySelector('button')?.focus();}
  function modalClose() {modal.innerHTML='';workspace.inert=false;$('sidebar').inert=false;modalReturnFocus?.focus({preventScroll:true});}
  $('stop-study').onclick=()=>{
    modalOpen('<h2 id="dialog-title">Stop the simulation?</h2><p>You can stop at any time. Stopping clears the responses saved in this browser tab.</p><div class="actions"><button class="secondary" id="keep-going">Keep going</button><button class="primary" id="confirm-stop">Stop and clear responses</button></div>');
    $('keep-going').onclick=modalClose;$('confirm-stop').onclick=()=>{modalClose();state.answers={q1:{},q2:{},q3:{}};state.visited=[];state.practiceReplies=[];state.skipped={q1:[],q2:[],q3:[]};state.presented=[];go('stopped');};
  };
  function renderDashboard() {
    selectNav('nav-overview');workspace.innerHTML=dashboard;
    workspace.querySelectorAll('button').forEach(b=>{b.disabled=true;});
    const ids=['jordan','riley','taylor'];workspace.querySelectorAll('.msg-av').forEach((el,i)=>{el.innerHTML=portrait(ids[i]);el.style.background='transparent';});
  }
  function renderTeam() {
    selectNav('nav-org');
    page('Client Services','Organizational Chart',`<div class="page-intro"><h1>Your Client Services team</h1><p><strong>You</strong> are the <strong>Director of Client Services</strong>. All five associates report directly to you. Click each profile to get acquainted.</p></div>
      <div class="team-chart"><div class="director-node"><strong>You</strong><small>Client Services Director</small></div><div class="team-grid">${D.people.map(p=>`<button class="team-member ${state.visited.includes(p.id)?'visited':''}" id="person-${p.id}" aria-label="Open ${esc(p.name)}’s profile">${state.visited.includes(p.id)?'<span class="check-badge" aria-label="Viewed">✓</span>':''}${portrait(p.id)}<strong>${p.name}</strong><small>Client Services Associate</small></button>`).join('')}</div></div>
      <p class="page-intro" id="profile-count">${state.visited.length} of 5 profiles viewed</p>`);
    D.people.forEach(p=>$('person-'+p.id).onclick=()=>openProfile(p.id));
  }
  function openProfile(id) {
    const p=person(id);if(!state.visited.includes(id)){state.visited.push(id);save();}
    modalOpen(`${portrait(id,'profile-portrait')}<h2 id="dialog-title">${p.name}</h2><div class="subtitle">Client Services Associate</div><p>${esc(p.bio)}</p><button class="primary" id="close-profile">Got it →</button>`);
    $('close-profile').onclick=()=>{modalClose();if(state.visited.length===5)go('profileDone');else {render();$('person-'+id)?.focus();}};
  }
  function inbox() {
    selectNav('nav-messages');const emails=[...D.practice,D.feedback[state.condition-1]];
    page('Messages','Inbox',`<div class="page-intro"><h1>Recent emails</h1><p>Four emails addressed to you, Client Services Director.</p></div><div class="email-list">${emails.map((m,i)=>`<button id="email-${i}" class="email-row ${i===state.nextEmail?'current':i<state.nextEmail?'read':''}" aria-disabled="${i!==state.nextEmail}" tabindex="${i===state.nextEmail?'0':'-1'}">${portrait(m.person)}<span class="email-row-body"><strong>${esc(m.sender)}</strong><span>${esc(m.subject)}</span><span class="email-preview">${i<state.nextEmail?'Read':i===3?'Feedback regarding your decision':esc(m.body.split('\n\n')[1])}</span></span><span class="email-label">${esc(m.date||'Today')}<br>✉ Email</span></button>`).join('')}</div>`);
    emails.forEach((m,i)=>$('email-'+i).onclick=()=>{if(i!==state.nextEmail)return;go(i<3?'practice':'feedback');});
  }
  function emailCard(m,recipient='You, Client Services Director') {
    return `<article class="email-card"><div class="email-header"><h1>${esc(m.subject)}</h1><div class="email-meta">${m.person?portrait(m.person):'<span class="portrait">You</span>'}<div><strong>From: ${esc(m.sender)}</strong><div>To: ${esc(recipient)}</div></div><span class="email-time">${esc(m.date||'Today')}</span></div></div><div class="email-body">${esc(m.body)}</div><div class="email-signature">${esc(m.signature)}</div></article>`;
  }
  function replyArea(proposed=false) {
    const draft=proposed?D.apology.body+'\n\n'+D.apology.signature:'';
    return `<div class="reply-area"><textarea id="email-reply" aria-label="Email reply" placeholder="Write a reply..." autocomplete="off" ${proposed?'readonly':''}>${esc(draft)}</textarea><div class="actions">${proposed?'<button class="primary" id="apology-questions">Continue to questions →</button>':'<button class="primary" id="send-reply">Send</button><button class="secondary" id="skip-reply">Skip reply</button>'}</div></div>`;
  }
  function practice() {
    selectNav('nav-messages');const m=D.practice[Math.min(state.nextEmail,2)];
    page('Messages','Email',emailCard(m)+replyArea());
    const finish=action=>{state.practiceReplies.push({email:state.nextEmail+1,subject:m.subject,action,
      answer:action==='sent'?$('email-reply').value:null,completedAt:new Date().toISOString()});
      $('email-reply').value='';state.nextEmail++;go('practiceDone');};
    $('send-reply').onclick=()=>finish('sent');$('skip-reply').onclick=()=>finish('skipped');
  }
  function feedbackEmail(proposed=false) {
    selectNav('nav-messages');page('Messages','Email',emailCard(D.feedback[state.condition-1])+replyArea(proposed));
    if(proposed) {
      $('email-reply').style.height=$('email-reply').scrollHeight+'px';
      $('apology-questions').onclick=()=>go('q3');return;
    }
    const interrupt=event=>{
      if(event?.cancelable)event.preventDefault();
      if(state.stage!=='feedback')return;
      state.feedbackScroll=workspace.querySelector('.workspace-body').scrollTop;
      $('email-reply').value='';go('feedbackDone');
    };
    $('email-reply').addEventListener('beforeinput',interrupt);
    $('email-reply').addEventListener('input',interrupt);
    $('send-reply').onclick=interrupt;$('skip-reply').onclick=interrupt;
  }
  function questionHTML(q,answers) {
    const val=answers[q.id];let input='';
    if(q.type==='text')input=`<textarea id="${q.id}" name="${q.id}" aria-labelledby="label-${q.id}" autocomplete="off">${esc(val||'')}</textarea>`;
    else if(q.type==='choice')input=`<div class="option-list">${q.options.map(s=>`<label class="choice-label"><input type="radio" name="${q.id}" value="${esc(s)}" ${val===s?'checked':''}>${esc(s)}</label>`).join('')}</div>`;
    else input=`<div class="scale-options">${Array.from({length:q.max},(_,i)=>`<label class="scale-choice"><input type="radio" name="${q.id}" value="${i+1}" aria-label="${i+1}${i===0?' — '+esc(q.low):i===q.max-1?' — '+esc(q.high):''}" ${Number(val)===i+1?'checked':''}><span>${i+1}</span></label>`).join('')}</div><div class="scale-anchors"><span>1 — ${esc(q.low)}</span>${q.mid?`<span>4 — ${esc(q.mid)}</span>`:''}<span>${q.max} — ${esc(q.high)}</span></div>`;
    return `<fieldset id="question-${q.id}"><legend id="label-${q.id}"><svg class="missing-icon" viewBox="0 0 24 24" role="img" aria-label="Unanswered question" hidden><circle cx="12" cy="12" r="10" fill="#c62828"/><path d="M12 6v7" stroke="white" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="white"/></svg>${esc(q.text)}</legend>${input}<button type="button" class="clear-answer" data-clear="${q.id}">Clear answer</button><button type="button" class="skip-question secondary" data-skip="${q.id}" hidden>Continue without answering this question</button><span class="skip-confirmation" hidden>Continuing without an answer.</span></fieldset>`;
  }
  function questionnaire(key) {
    selectNav(key==='q1'?'nav-org':'nav-messages');
    const sections=Q[key], i=Math.min(state.qPage[key]||0,sections.length-1), section=sections[i], reviewKey=key+'-'+i;
    page('Orbit SmartHub','Questions',`<form class="questionnaire" id="questionnaire" novalidate><p class="muted">Questionnaire ${key.slice(1)} · Page ${i+1} of ${sections.length}</p><h1>${esc(section.title)}</h1><p class="muted">You may leave any question unanswered.</p><div class="questionnaire-progress" aria-hidden="true"><span style="width:${(i+1)/sections.length*100}%"></span></div>${section.intro?`<p>${esc(section.intro)}</p>`:''}${section.items.map(q=>questionHTML(q,state.answers[key])).join('')}<div class="actions"><button class="primary" type="submit">${i===sections.length-1?'Continue →':'Next →'}</button></div></form>`);
    state.presented=[...new Set([...state.presented,...section.items.map(q=>q.id)])];save();
    const form=$('questionnaire');
    const hasAnswer=q=>state.answers[key][q.id]!==null && state.answers[key][q.id]!==undefined && String(state.answers[key][q.id]).trim()!=='';
    function markMissing() {
      section.items.forEach(q=>{
        const field=$('question-'+q.id),skipped=state.skipped[key].includes(q.id),missing=Boolean(state.reviewed[reviewKey])&&!hasAnswer(q)&&!skipped;
        field.classList.toggle('unanswered',missing);
        field.querySelector('.missing-icon').toggleAttribute('hidden',!missing);
        field.querySelector('[data-skip]').hidden=!missing;
        field.querySelector('.skip-confirmation').hidden=!skipped;
      });
    }
    function collect() {
      const values=new FormData(form);
      section.items.forEach(q=>{const v=values.get(q.id);state.answers[key][q.id]=v===null||String(v).trim()===''?null:q.type==='scale'?Number(v):v;
        if(hasAnswer(q))state.skipped[key]=state.skipped[key].filter(id=>id!==q.id);
      });save();markMissing();
    }
    form.addEventListener('change',collect);form.addEventListener('input',e=>{if(e.target.matches('textarea'))collect();});
    form.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{form.querySelectorAll(`[name="${b.dataset.clear}"]`).forEach(el=>{if(el.type==='radio')el.checked=false;else el.value='';});collect();});
    form.querySelectorAll('[data-skip]').forEach(b=>b.onclick=()=>{
      const field=b.closest('fieldset');state.skipped[key].push(b.dataset.skip);state.answers[key][b.dataset.skip]=null;save();markMissing();
      const next=section.items.find(q=>!hasAnswer(q)&&!state.skipped[key].includes(q.id));
      if(next){const el=$('question-'+next.id);el.scrollIntoView({block:'center'});el.querySelector('input,textarea').focus({preventScroll:true});}
      else form.querySelector('[type="submit"]').focus({preventScroll:true});
    });
    form.onsubmit=e=>{
      e.preventDefault();collect();
      const missing=section.items.filter(q=>!hasAnswer(q)&&!state.skipped[key].includes(q.id));
      if(missing.length) {
        state.reviewed[reviewKey]=true;save();markMissing();
        guide(`You missed ${missing.length} ${missing.length===1?'question':'questions'}. Would you like to answer ${missing.length===1?'it':'them'} before continuing?`,'Review questions →',()=>{
          clearGuide();const field=$('question-'+missing[0].id);field.scrollIntoView({block:'center'});field.querySelector('input,textarea').focus({preventScroll:true});
        });return;
      }
      if(i<sections.length-1){state.qPage[key]=i+1;save();render();}else {if(key==='q3')state.completedAt=new Date().toISOString();go(key==='q1'?'messagesNav':key==='q2'?'apologyIntro':'complete');}
    };
    markMissing();
  }
  function researchPayload() {return I.payload(state,D,Q,C);}
  function downloadPreview() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(researchPayload(),null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='orbit-preview-responses.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  let submitting=false;
  async function finishCollection() {
    if(submitting || state.stage!=='complete')return;
    if(I.acknowledged(state.submission)) {
      location.assign(I.feedback(C,state));return;
    }
    submitting=true;
    page('Orbit SmartHub','Complete','<article class="reading-card" role="status"><h1>Saving your responses…</h1><p>Please keep this page open. You will continue to the feedback form once your responses are saved.</p></article>');
    try {
      const receipt=await I.submit(C,researchPayload());
      state.submission={...receipt,acknowledgedAt:new Date().toISOString()};save();
      location.assign(I.feedback(C,state));
    } catch(error) {
      const duplicate=error.message==='SAVE_ALREADY_EXISTS';
      page('Orbit SmartHub','Complete',`<article class="reading-card" role="alert"><h1>Your submission needs attention</h1><p>${duplicate?'A submission with this session ID already exists, but we could not confirm it here. Please contact the study researcher before closing this page.':'We could not confirm that your responses were saved. Your answers are still in this tab. Please check your connection and try again.'}</p><div class="actions">${duplicate?'':'<button class="primary" id="retry-save">Try again</button>'}<button class="secondary" id="download-backup">Download a copy of my responses</button></div></article>`);
      if($('retry-save'))$('retry-save').onclick=finishCollection;
      $('download-backup').onclick=downloadPreview;
    } finally {submitting=false;}
  }
  function render() {
    clearGuide();$('stop-study').hidden=['complete','stopped'].includes(state.stage);
    if(C.mode==='collect' && !I.ready(C,state)) {
      selectNav('nav-overview');$('stop-study').hidden=true;
      page('Orbit SmartHub','Study link','<article class="reading-card"><h1>This study link is not ready</h1><p>Please return to the link provided in Qualtrics. If this message continues, contact the study researcher.</p></article>');return;
    }
    switch(state.stage) {
      case 'welcome': renderDashboard();guide("Welcome back to Orbit SmartHub! I’m Sparky, your virtual assistant. We’ve made some changes to the layout since you were last here, so I’ll be taking you around to make sure you’re familiar with everything. I’ll also be asking you a few questions along the way to understand your experiences. Let’s get started!",'Show me around →',()=>go('landing'));break;
      case 'landing': renderDashboard();guide('This is your landing page. Here you’ll see a snapshot of your open tasks, recent messages from your team, notes from past meetings, and key team metrics at a glance.','Next →',()=>go('overview'),null,'corner');break;
      case 'overview': renderDashboard();enableNav('nav-overview',()=>go('orgNav'));guide('Whenever you want to return to this page, click the Overview button in the sidebar.','Next →',()=>go('orgNav'),$('nav-overview'),'corner');break;
      case 'orgNav': renderDashboard();enableNav('nav-org',()=>go('orgIntro'));guide('Now let’s check out your Organizational Chart — click it to continue!',null,null,$('nav-org'),'corner');break;
      case 'orgIntro': renderTeam();guide('Here you’ll find your team. Make sure to click on each of them to get acquainted with your team!','Got it →',()=>go('profiles'));break;
      case 'profiles': renderTeam();break;
      case 'profileDone': renderTeam();guide('Great work — you’ve met everyone! Before you move on, do you mind answering a few quick questions?','Sure! →',()=>go('q1'));break;
      case 'q1': case 'q2': case 'q3': questionnaire(state.stage);break;
      case 'messagesNav': renderTeam();enableNav('nav-messages',()=>go('messagesIntro'));guide('Thank you so much! Now let’s check some messages before we get into your tasks. Click Messages in the sidebar to continue.',null,null,$('nav-messages'));break;
      case 'messagesIntro': inbox();guide('Welcome to the Messages page! Here you’ll find your recent emails. It looks like you have four emails. We’ll work through them in order. Let’s click on the top one to get started!','Got it →',()=>go('inbox'),$('nav-messages'));break;
      case 'inbox': inbox();shade($('email-'+state.nextEmail));$('email-'+state.nextEmail)?.focus({preventScroll:true});break;
      case 'practice': practice();break;
      case 'practiceDone': inbox();guide(state.nextEmail===3?'Great! Now just one more message to go through.':'Great! Now let’s respond to the next message.','Back to messages →',()=>go('inbox'));break;
      case 'scenario': state.stage='feedback';save();feedbackEmail();break;
      case 'feedback': feedbackEmail();break;
      case 'feedbackDone': feedbackEmail();guide('Before you reply, do you mind answering some questions about how this email makes you feel?','Continue to questions →',()=>go('q2'));break;
      case 'apologyIntro': feedbackEmail(true);guide('I drafted a potential response to this email, do you mind reading it and answering some more questions?','Continue',()=>go('apology'));break;
      case 'apology': feedbackEmail(true);break;
      case 'complete': selectNav('nav-messages');if(C.mode==='collect'){finishCollection();break;}page('Orbit SmartHub','Complete','<article class="reading-card"><h1>Thank you for completing the simulation.</h1><p>You’ve reached the end of this website preview.</p><p class="review-note">Your answers have not been submitted to a research database. This preview keeps them only in this browser tab. Consent, study feedback and Qualtrics submission are not connected yet.</p><div class="actions"><button class="secondary" id="download-preview">Download preview responses</button><button class="primary" id="restart">Start a new preview</button></div></article>');$('download-preview').onclick=downloadPreview;$('restart').onclick=()=>{state=freshState();save();render();};break;
      case 'stopped': selectNav('nav-overview');page('Orbit SmartHub','Stopped','<article class="reading-card"><h1>Simulation stopped</h1><p>Your saved responses have been cleared from this browser tab.</p><button class="primary" id="restart">Start a new preview</button></article>');$('restart').onclick=()=>{state=freshState();save();render();};break;
      default: state=freshState();save();render();
    }
    if(!target)workspace.querySelector('.workspace-body')?.scrollTo(0,['feedbackDone','apologyIntro','apology'].includes(state.stage)?state.feedbackScroll:0);
    if(!overlay.classList.contains('active')) {const h=workspace.querySelector('h1');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}}
  }
  // Saving a changed condition creates a fresh session; reloading otherwise resumes exactly.
  save();render();
})();
