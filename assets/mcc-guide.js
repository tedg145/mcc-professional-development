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
  var coaching={
    'how-it-works/':{hint:'Follow the three stages in order: training, context, then prediction. Ask what information exists at each stage.',explain:'A language model does not retrieve a finished answer. It predicts a likely continuation from patterns, instructions, and the context it can currently see.',next:'After the walkthrough, try Context Lab and change one piece of information at a time.'},
    'language-math/':{hint:'Separate the visible words from their numerical representations. The model operates on tokens, vectors, and probabilities—not meanings stored as sentences.',explain:'The mathematics maps language into relationships and likelihoods. Similar ideas can occupy nearby regions without becoming identical.',next:'Return to How an LLM Works for the mental model, or move to Verification if you want to test outputs.'},
    'scenarios/':{hint:'Pause before deciding. Identify the claim, the consequence if it is wrong, and the evidence you would need.',explain:'These scenarios fail on purpose so you can practice judgment when an AI answer sounds more certain than its evidence allows.',next:'Record the verification step you would use in real work, then compare it with the scenario debrief.'},
    'context-lab/':{hint:'Change only one variable between attempts. That makes the effect of added or missing context easier to see.',explain:'AI output depends on the context available in the current interaction. Relevant details narrow the space of plausible responses.',next:'Try the same request with an audience, constraint, example, and verification requirement.'},
    'find-the-error/':{hint:'Do not evaluate the answer as one block. Check names, dates, numbers, quotations, and causal claims separately.',explain:'A fluent answer can contain one unsupported detail. Verification works better when claims are decomposed into checkable parts.',next:'Move to Verification and practice finding evidence for each important claim.'},
    'verification/':{hint:'Trace the claim to the original source. A search result, summary, or repeated quotation is not the same as primary evidence.',explain:'Verification asks whether the cited evidence exists, supports the precise claim, and is appropriate for the decision being made.',next:'Write down a repeatable three-step check you could use for MCC work.'},
    'inspector/':{hint:'Look beyond the visible content. Compare file properties, author fields, timestamps, location data, and revision information.',explain:'Files can carry metadata that is not obvious on screen. This lab keeps the file in your browser while showing what may travel with it.',next:'Use a non-sensitive sample file, then decide what should be removed before sharing a real document.'},
    'inbox/':{hint:'Sort by risk before speed. Sensitive data, consequential decisions, and unclear authority need human attention first.',explain:'The goal is not to use AI on every message. It is to recognize which work benefits from assistance and which work requires direct judgment.',next:'Choose one low-risk repetitive message and draft a reusable workflow for it.'},
    'workshop/':{hint:'Define the user, task, data boundary, and failure condition before choosing tools or writing code.',explain:'A useful AI tool combines a narrow purpose with clear safeguards, testing, and a human decision point.',next:'Write a one-sentence tool charter, then build the smallest testable version.'},
    'sandbox/':{hint:'Read the authorization boundary before using a connector. Ask what the assistant can access, change, and disclose.',explain:'The sandbox makes permissions visible so you can practice separating capability from authorization.',next:'Run one mission with the narrowest permission that can complete the task.'},
    'presentations/':{hint:'Choose the deck by audience and learning objective, then adapt examples to the session rather than presenting every slide.',explain:'The library separates reusable teaching materials from interactive activities elsewhere on the site.',next:'Open the deck that matches your audience and pair it with one hands-on activity.'},
    'tools/':{hint:'Compare failure modes and data practices—not only features and price.',explain:'The best tool depends on the task, institutional constraints, and what happens when the system is wrong.',next:'Shortlist two tools and test both with the same low-risk example.'},
    'hours/':{hint:'Start with work that is frequent, structured, low-risk, and easy to review.',explain:'Time savings usually come from repeated workflow steps, not from automating an entire job at once.',next:'Choose one task and document its trigger, inputs, steps, review point, and final output.'},
    '':{hint:'Start with the goal, not the tool. Decide whether you want to learn, practice, build, or use AI for real work.',explain:'This hub organizes MCC resources into four zones and can filter them for faculty, staff, supervisors, and builders.',next:'Open How an LLM Works for the foundation, or choose your role on the hub.'}
  };
  var support=coaching[current.path]||coaching[''];
  try{if(current.path)localStorage.setItem('mcc-last-page-v1',JSON.stringify({path:current.path,title:current.title,at:Date.now()}));}catch(e){}

  var guide=document.createElement('div');guide.className='mcc-guide';guide.dataset.mccGuide='';
  guide.innerHTML='<section class="mcc-guide__panel" aria-label="MCC AI Guide" aria-hidden="true">'
    +'<header class="mcc-guide__header"><img class="mcc-guide__face" src="'+new URL('assets/mac-avatar.webp',root).href+'" alt=""><div class="mcc-guide__title"><strong>Mac · MCC AI Guide</strong><small><span class="mcc-guide__status-dot"></span><span data-guide-status aria-live="polite">Ready to help</span></small></div><button class="mcc-guide__close" type="button" aria-label="Close Mac AI Guide">×</button></header>'
    +'<div class="mcc-guide__context">CURRENT LOCATION · <strong data-guide-context>'+escapeHtml(contextLabel())+'</strong></div>'
    +'<div class="mcc-guide__tabs" role="tablist"><button class="mcc-guide__tab is-active" data-mode="navigator" type="button">🧭 Navigator</button><button class="mcc-guide__tab" data-mode="coach" type="button">◉ Coach</button><button class="mcc-guide__tab" data-mode="builder" type="button">⌘ Builder</button></div>'
    +'<div class="mcc-guide__welcome"><img src="'+new URL('assets/mac-navigator.webp',root).href+'" alt="Mac the Highlander, MCC AI learning guide"><p><strong>Hello, I’m Mac.</strong><span>Tell me what you want to accomplish. I’ll point you toward the best MCC activity.</span></p></div>'
    +'<div class="mcc-guide__messages" aria-live="polite"><div class="mcc-guide__message">Choose a quick question below, or describe what you need help learning, checking, or building.</div></div>'
    +'<div class="mcc-guide__choices"><button class="mcc-guide__choice" data-guide-action="hint" type="button">Give me a hint</button><button class="mcc-guide__choice" data-guide-action="explain" type="button">Explain this</button><button class="mcc-guide__choice" data-guide-action="next" type="button">What next?</button></div>'
    +'<div class="mcc-guide__compose"><div class="mcc-guide__compose-row"><input type="text" aria-label="Ask the MCC AI Guide" placeholder="What would you like to do?"><button class="mcc-guide__send" type="button">Send</button></div><p class="mcc-guide__privacy">This guide uses the MCC site map in your browser. It does not send your message to an outside AI service.</p></div></section>'
    +'<span class="mcc-guide__move-help" id="mcc-guide-move-help">Drag Mac to move him. With the button focused, use Shift plus an arrow key to move him.</span><button class="mcc-guide__launcher" type="button" aria-label="Ask Mac, the MCC AI Guide" aria-describedby="mcc-guide-move-help" aria-expanded="false"><img class="mcc-guide__launcher-avatar" src="'+new URL('assets/mac-avatar.webp',root).href+'" alt=""><span><strong>Ask Mac</strong><small>Navigator · Coach · Builder</small></span></button>';
  document.body.appendChild(guide);
  var panel=guide.querySelector('.mcc-guide__panel'),launcher=guide.querySelector('.mcc-guide__launcher'),messages=guide.querySelector('.mcc-guide__messages'),input=guide.querySelector('input'),status=guide.querySelector('[data-guide-status]'),context=guide.querySelector('[data-guide-context]');
  var mode='navigator';
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function contextLabel(){var step=decodeURIComponent(location.hash.replace(/^#/,''));if(step==='hub')step='';return current.title+(step?' · '+step.replace(/[-_/]+/g,' '):'');}
  function modeName(){return mode.charAt(0).toUpperCase()+mode.slice(1)+' mode';}
  function setState(state,label){guide.classList.remove('is-thinking','is-success');if(state)guide.classList.add('is-'+state);status.textContent=label||'Ready to help';}
  function positionPanel(){var r=launcher.getBoundingClientRect();guide.classList.toggle('opens-right',r.left<innerWidth/2);guide.classList.toggle('opens-down',r.top<Math.min(430,innerHeight*.52));}
  function open(){positionPanel();guide.classList.add('is-open');panel.setAttribute('aria-hidden','false');launcher.setAttribute('aria-expanded','true');setTimeout(function(){input.focus();},50);}
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
    var card=document.createElement('div');card.className='mcc-guide__recommendation';card.innerHTML='<small>'+escapeHtml(picked.zone)+' recommendation</small><strong>'+escapeHtml(picked.title)+'</strong><p>'+escapeHtml(why)+'</p><a href="'+new URL(picked.path,root).href+'">Open '+escapeHtml(picked.title)+' →</a>';messages.appendChild(card);messages.scrollTop=messages.scrollHeight;setState('success','Recommendation ready');window.setTimeout(function(){setState('',modeName());},1100);
  }
  function send(query){query=(query||input.value).trim();if(!query)return;open();addMessage(query,true);input.value='';setState('thinking','Thinking through your goal');window.setTimeout(function(){recommend(query);},360);}
  function coach(action){open();mode='coach';guide.querySelectorAll('[data-mode]').forEach(function(x){x.classList.toggle('is-active',x.dataset.mode==='coach');});addMessage(action==='hint'?'Give me a hint.':action==='explain'?'Explain this concept.':'What should I do next?',true);setState('thinking','Reading this activity');window.setTimeout(function(){addMessage(support[action]);setState('success','Coaching note ready');window.setTimeout(function(){setState('',modeName());},1100);},320);}
  var drag=null,suppressClick=false,positionKey='mcc-guide-position-v1';
  function place(left,top,save){var maxLeft=Math.max(8,innerWidth-launcher.offsetWidth-8),maxTop=Math.max(8,innerHeight-launcher.offsetHeight-8);left=Math.min(Math.max(8,left),maxLeft);top=Math.min(Math.max(8,top),maxTop);guide.style.left=left+'px';guide.style.top=top+'px';guide.style.right='auto';guide.style.bottom='auto';if(save)try{localStorage.setItem(positionKey,JSON.stringify({left:left/innerWidth,top:top/innerHeight}));}catch(e){}if(guide.classList.contains('is-open'))positionPanel();}
  function restore(){try{var p=JSON.parse(localStorage.getItem(positionKey)||'null');if(p)place(p.left*innerWidth,p.top*innerHeight,false);}catch(e){}}
  launcher.addEventListener('pointerdown',function(e){drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:launcher.getBoundingClientRect().left,top:launcher.getBoundingClientRect().top,moved:false};launcher.setPointerCapture(e.pointerId);});
  launcher.addEventListener('pointermove',function(e){if(!drag||drag.id!==e.pointerId)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>6){drag.moved=true;guide.classList.add('is-dragging');place(drag.left+dx,drag.top+dy,false);}});
  launcher.addEventListener('pointerup',function(e){if(!drag||drag.id!==e.pointerId)return;if(drag.moved){suppressClick=true;place(launcher.getBoundingClientRect().left,launcher.getBoundingClientRect().top,true);}drag=null;guide.classList.remove('is-dragging');});
  launcher.addEventListener('pointercancel',function(){drag=null;guide.classList.remove('is-dragging');});
  launcher.addEventListener('click',function(){if(suppressClick){suppressClick=false;return;}guide.classList.contains('is-open')?close():open();});
  launcher.addEventListener('keydown',function(e){if(!e.shiftKey||!/^Arrow/.test(e.key))return;e.preventDefault();var r=launcher.getBoundingClientRect(),dx=e.key==='ArrowLeft'?-16:e.key==='ArrowRight'?16:0,dy=e.key==='ArrowUp'?-16:e.key==='ArrowDown'?16:0;place(r.left+dx,r.top+dy,true);});
  guide.querySelector('.mcc-guide__close').addEventListener('click',close);
  guide.querySelector('.mcc-guide__send').addEventListener('click',function(){send();});
  input.addEventListener('keydown',function(e){if(e.key==='Enter')send();});
  guide.querySelectorAll('[data-guide-action]').forEach(function(b){b.addEventListener('click',function(){coach(b.dataset.guideAction);});});
  guide.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){mode=b.dataset.mode;guide.querySelectorAll('[data-mode]').forEach(function(x){x.classList.toggle('is-active',x===b);});var intro={navigator:'I’ll help you find the right MCC resource.',coach:'I’ll help you reason through the current learning activity without simply giving away the answer.',builder:'I’ll route you toward prompts, prototypes, safeguards, and tool-building resources.'};setState('',modeName());addMessage(intro[mode]);});});
  window.addEventListener('hashchange',function(){context.textContent=contextLabel();});
  window.addEventListener('resize',function(){var r=launcher.getBoundingClientRect();place(r.left,r.top,false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&guide.classList.contains('is-open'))close();});
  restore();
  window.MCCGuide={open:open,close:close};
})();
