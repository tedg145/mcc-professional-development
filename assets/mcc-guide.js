(function(){
  'use strict';
  if(document.querySelector('[data-mcc-guide]')) return;
  var script=[].slice.call(document.scripts).find(function(s){return /mcc-guide\.js(?:\?|$)/.test(s.src);});
  var root=script?new URL('../',script.src):new URL('/',location.href);
  var css=document.createElement('link');css.rel='stylesheet';css.href=new URL('assets/mcc-guide.css',root).href;document.head.appendChild(css);
  var content=[
    {title:'How an LLM Works',path:'how-it-works/',zone:'Learn',words:'llm model token context training accuracy foundations explain'},
    {title:'Language & Math',path:'language-math/',zone:'Learn',words:'language math vector probability equation attention embedding'},
    {title:'Presentations',path:'presentations/',zone:'Use',words:'slides presentation deck faculty staff workshop download'},
    {title:'Scenarios',path:'scenarios/',zone:'Practice',words:'scenario mission citation redaction policy decision risk'},
    {title:'Context Lab',path:'context-lab/',zone:'Practice',words:'context prompt output meaning experiment lab'},
    {title:'Find the Error',path:'find-the-error/',zone:'Practice',words:'error hallucination inspect critique accuracy'},
    {title:'Verification Lab',path:'verification/',zone:'Practice',words:'verify source evidence fact check accuracy'},
    {title:'Metadata Inspector',path:'inspector/',zone:'Practice',words:'metadata privacy photo document file gps author inspect'},
    {title:'The Inbox Hour',path:'inbox/',zone:'Use',words:'email inbox productivity communication staff'},
    {title:'Build Your Own Tools',path:'workshop/',zone:'Build',words:'build code tool hosting security database workshop'},
    {title:'Sabine Crossing Sandbox',path:'sandbox/',zone:'Build',words:'sandbox assistant connector terminal authorization practice'},
    {title:'Tool Bench',path:'tools/',zone:'Use',words:'tools compare cost failure reference choose'},
    {title:'Find Your Ten Hours',path:'hours/',zone:'Use',words:'time hours workflow productivity automate repeated task'}
  ];
  var localPath=location.pathname.replace(/^.*\/mcc-professional-development\/?/,'').replace(/index\.html$/,'');
  var current=content.find(function(x){return localPath.indexOf(x.path.replace(/\/$/,''))===0;})||{title:'MCC AI Professional Development',zone:'Hub',path:''};
  try{if(current.path)localStorage.setItem('mcc-last-page-v1',JSON.stringify({path:current.path,title:current.title,at:Date.now()}));}catch(e){}

  var guide=document.createElement('div');guide.className='mcc-guide';guide.dataset.mccGuide='';
  guide.innerHTML='<section class="mcc-guide__panel" aria-label="MCC AI Guide" aria-hidden="true">'
    +'<header class="mcc-guide__header"><div class="mcc-guide__face">AI</div><div class="mcc-guide__title"><strong>MCC AI Guide</strong><small>Site-grounded learning assistant</small></div><button class="mcc-guide__close" type="button" aria-label="Close AI Guide">×</button></header>'
    +'<div class="mcc-guide__context">CURRENT LOCATION · <strong>'+escapeHtml(current.title)+'</strong></div>'
    +'<div class="mcc-guide__tabs" role="tablist"><button class="mcc-guide__tab is-active" data-mode="navigator" type="button">🧭 Navigator</button><button class="mcc-guide__tab" data-mode="coach" type="button">◉ Coach</button><button class="mcc-guide__tab" data-mode="builder" type="button">⌘ Builder</button></div>'
    +'<div class="mcc-guide__messages" aria-live="polite"><div class="mcc-guide__message">Tell me what you want to accomplish. I’ll point you to the best MCC activity and explain why it fits.</div></div>'
    +'<div class="mcc-guide__choices"><button class="mcc-guide__choice" data-query="Where should I start?" type="button">Start here</button><button class="mcc-guide__choice" data-query="Help me use AI safely" type="button">Use AI safely</button><button class="mcc-guide__choice" data-query="I want to build an AI tool" type="button">Build something</button></div>'
    +'<div class="mcc-guide__compose"><div class="mcc-guide__compose-row"><input type="text" aria-label="Ask the MCC AI Guide" placeholder="What would you like to do?"><button class="mcc-guide__send" type="button">Send</button></div><p class="mcc-guide__privacy">This guide uses the MCC site map in your browser. It does not send your message to an outside AI service.</p></div></section>'
    +'<button class="mcc-guide__launcher" type="button" aria-label="Open MCC AI Guide" aria-expanded="false"><span class="mcc-guide__orb" aria-hidden="true"></span><span><strong>MCC AI Guide</strong><small>Navigator · Coach · Builder</small></span></button>';
  document.body.appendChild(guide);
  var panel=guide.querySelector('.mcc-guide__panel'),launcher=guide.querySelector('.mcc-guide__launcher'),messages=guide.querySelector('.mcc-guide__messages'),input=guide.querySelector('input');
  var mode='navigator';
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function open(){guide.classList.add('is-open');panel.setAttribute('aria-hidden','false');launcher.setAttribute('aria-expanded','true');setTimeout(function(){input.focus();},50);}
  function close(){guide.classList.remove('is-open');panel.setAttribute('aria-hidden','true');launcher.setAttribute('aria-expanded','false');launcher.focus();}
  function addMessage(text,user){var el=document.createElement('div');el.className='mcc-guide__message'+(user?' mcc-guide__message--user':'');el.textContent=text;messages.appendChild(el);messages.scrollTop=messages.scrollHeight;}
  function score(item,words){var hay=(item.title+' '+item.zone+' '+item.words).toLowerCase(),score=0;words.forEach(function(w){if(w.length>2&&hay.indexOf(w)>=0)score+=1;});return score;}
  function recommend(query){
    var q=query.toLowerCase(),words=q.split(/[^a-z0-9]+/).filter(Boolean),picked;
    if(mode==='builder'||/build|code|prototype|automation|tool/.test(q))picked=content.find(function(x){return x.title==='Build Your Own Tools';});
    else if(mode==='coach'&&current.path)picked=current;
    else if(/safe|risk|private|sensitive|decision/.test(q))picked=content.find(function(x){return x.title==='Scenarios';});
    else if(/prompt|context/.test(q))picked=content.find(function(x){return x.title==='Context Lab';});
    else if(/verify|source|fact|accur/.test(q))picked=content.find(function(x){return x.title==='Verification Lab';});
    else picked=content.map(function(x){return {item:x,score:score(x,words)};}).sort(function(a,b){return b.score-a.score;})[0].item;
    var why=mode==='coach'&&current.path?'Stay with the current activity and use its prompts as checkpoints. If you are stuck, review the concept before revealing the answer.':'This is the closest match in the MCC learning environment based on your goal.';
    var card=document.createElement('div');card.className='mcc-guide__recommendation';card.innerHTML='<small>'+escapeHtml(picked.zone)+' recommendation</small><strong>'+escapeHtml(picked.title)+'</strong><p>'+escapeHtml(why)+'</p><a href="'+new URL(picked.path,root).href+'">Open '+escapeHtml(picked.title)+' →</a>';messages.appendChild(card);messages.scrollTop=messages.scrollHeight;
  }
  function send(query){query=(query||input.value).trim();if(!query)return;open();addMessage(query,true);input.value='';window.setTimeout(function(){recommend(query);},180);}
  launcher.addEventListener('click',function(){guide.classList.contains('is-open')?close():open();});
  guide.querySelector('.mcc-guide__close').addEventListener('click',close);
  guide.querySelector('.mcc-guide__send').addEventListener('click',function(){send();});
  input.addEventListener('keydown',function(e){if(e.key==='Enter')send();});
  guide.querySelectorAll('[data-query]').forEach(function(b){b.addEventListener('click',function(){send(b.dataset.query);});});
  guide.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){mode=b.dataset.mode;guide.querySelectorAll('[data-mode]').forEach(function(x){x.classList.toggle('is-active',x===b);});var intro={navigator:'I’ll help you find the right MCC resource.',coach:'I’ll help you reason through the current learning activity without simply giving away the answer.',builder:'I’ll route you toward prompts, prototypes, safeguards, and tool-building resources.'};addMessage(intro[mode]);});});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&guide.classList.contains('is-open'))close();});
  window.MCCGuide={open:open,close:close};
})();
