/* Shared, credential-free study data and completion helpers. */
(function(root) {
  'use strict';
  const conditions = Object.freeze({
    1: {code:'single-angry',source:'single',emotion:'angry'},
    2: {code:'single-disappointed',source:'single',emotion:'disappointed'},
    3: {code:'multiple-angry',source:'multiple',emotion:'angry'},
    4: {code:'multiple-disappointed',source:'multiple',emotion:'disappointed'}
  });
  function condition(config, search, random) {
    if(conditions[config.fixedCondition]) return Number(config.fixedCondition);
    const c=new URLSearchParams(search).get('c');
    return /^[1-4]$/.test(c||'') ? Number(c) : random();
  }
  function participant(search) {
    const id=new URLSearchParams(search).get('qualtrics_id')||'';
    return /^R_[A-Za-z0-9_-]{1,125}$/.test(id) ? id : null;
  }
  function feedback(config, state) {
    const url=new URL(config.feedbackUrl);
    if(url.protocol!=='https:' || !/(^|\.)qualtrics\.com$/.test(url.hostname) || !/^\/jfe\/form\/SV_[A-Za-z0-9]+\/?$/.test(url.pathname) || url.username || url.password)
      throw new Error('A published Qualtrics feedback survey URL is required.');
    if(!state.qualtricsId)throw new Error('A Qualtrics response ID is required.');
    url.searchParams.set(config.feedbackIdParameter||'orbit_source_response_id',state.qualtricsId);
    url.searchParams.set('orbit_condition',conditions[state.condition].code);
    url.searchParams.set('orbit_session_id',state.sessionId);
    url.searchParams.set('orbit_completed','1');
    return url.href;
  }
  function ready(config,state) {
    if(config.mode!=='collect'||!conditions[config.fixedCondition])return false;
    if(!destinationReady(config))return false;
    try {feedback(config,state);return true;}catch{return false;}
  }
  function destinationReady(config) {
    if(config.submissionProvider==='datapipe')return config.submissionEndpoint==='https://pipe.jspsych.org/api/data/' && /^[A-Za-z0-9_-]{6,128}$/.test(config.dataPipeExperimentId||'');
    return (!config.submissionProvider||config.submissionProvider==='direct-osf') && config.submissionEndpoint==='/api/submit';
  }
  function acknowledged(receipt) {return ['stored','queued'].includes(receipt?.status);}
  function payload(state,data,questions,config) {
    const rows=Object.entries(questions).flatMap(([key,sections])=>sections.flatMap((section,page)=>section.items.map(q=>{
      const answer=state.answers[key][q.id]??null;
      return {questionnaire:key,page:page+1,section:section.title,questionId:q.id,question:q.text,
        introduction:section.intro||'',type:q.type,answer,
        status:state.skipped[key].includes(q.id)?'skipped':answer!==null?'answered':state.presented.includes(q.id)?'unanswered':'not_presented',
        options:q.options||null,scale:q.type==='scale'?{min:1,max:q.max,low:q.low,high:q.high,mid:q.mid||null}:null};
    })));
    return {schemaVersion:7,siteVersion:'2026-10-21.11',siteId:config.siteId,mode:config.mode,
      qualtricsResponseId:state.qualtricsId,sessionId:state.sessionId,conditionNumber:state.condition,
      condition:conditions[state.condition],startedAt:state.startedAt,completedAt:state.completedAt,
      status:state.stage,assignments:data.people.map((p,i)=>({employee:p.name,biography:state.bios[i]+1,photo:p.photo,pronouns:p.pronouns})),
      profilesViewed:state.visited,questionnaire1:{...state.answers.q1},questionnaire2:{...state.answers.q2},questionnaire3:{...state.answers.q3},
      questions:rows,practiceReplies:state.practiceReplies,
      finalReply:{status:'interrupted_before_entry',answer:null},
      stimuli:{practice:data.practice,receivedEmail:data.feedback[state.condition-1],proposedResponse:data.apology}};
  }
  async function submit(config,record,fetcher=fetch) {
    if(config.mode!=='collect'||record.mode!=='collect'||!destinationReady(config))throw new Error('SAVE_NOT_CONFIGURED');
    const pipe=config.submissionProvider==='datapipe';
    // A retry keeps the same filename. Never create a second file after an uncertain save.
    const body=pipe?{experimentID:config.dataPipeExperimentId,filename:`orbit-${record.sessionId}.json`,data:JSON.stringify(record)}:record;
    const response=await fetcher(config.submissionEndpoint,{
      method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',referrerPolicy:'no-referrer',
      signal:AbortSignal.timeout(65000),body:JSON.stringify(body)
    });
    let result;try{result=await response.json();}catch{throw new Error('SAVE_UNCONFIRMED');}
    if(!result||typeof result!=='object')throw new Error('SAVE_UNCONFIRMED');
    if(pipe) {
      if(response.status===201 && !result.error)return {status:'stored',provider:'datapipe',filename:body.filename};
      // DataPipe already holds queued data durably and retries delivery itself.
      if(response.status===202 && result.error===null)return {status:'queued',provider:'datapipe',filename:body.filename};
      if(['FILE_EXISTS','OSF_FILE_EXISTS'].includes(result.error))throw new Error('SAVE_ALREADY_EXISTS');
      throw new Error('SAVE_UNCONFIRMED');
    }
    if(response.status===201 && result.status==='stored' && result.sessionId===record.sessionId)return {status:'stored'};
    if(response.status===409)throw new Error('SAVE_ALREADY_EXISTS');
    throw new Error('SAVE_UNCONFIRMED');
  }

  const api={conditions,condition,participant,feedback,ready,payload,submit,acknowledged};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ORBIT_INTEGRATION=api;
})(typeof window==='object'?window:globalThis);
