(function(){
  'use strict';
  if(document.querySelector('[data-mcc-guide]')) return;
  var script=[].slice.call(document.scripts).find(function(s){return /mcc-guide\.js(?:\?|$)/.test(s.src);});
  var root=script?new URL('../',script.src):new URL('/',location.href);
  var css=document.createElement('link');css.rel='stylesheet';css.href=new URL('assets/mcc-guide.css',root).href;document.head.appendChild(css);
  var content=window.MCC_CONTENT||[];
  var localPath=location.pathname.replace(/^.*\/mcc-professional-development\/?/,'').replace(/index\.html$/,'');
  var current=content.find(function(x){return localPath.indexOf(x.path.replace(/\/$/,''))===0;})||{title:'MCC AI Professional Development',zone:'Hub',path:''};
  var support=current.coach||{hint:'Start with the goal, not the tool. Decide whether you want to learn, practice, build, or use AI for real work.',explain:'This hub organizes MCC resources into four zones and can filter them for faculty, staff, supervisors, and builders.',next:'Open How an LLM Works for the foundation, or choose your role on the hub.'};
  try{if(current.path)localStorage.setItem('mcc-last-page-v1',JSON.stringify({path:current.path,title:current.title,at:Date.now()}));}catch(e){}

  var guide=document.createElement('div');guide.className='mcc-guide';guide.dataset.mccGuide='';
  guide.innerHTML='<section class="mcc-guide__panel" aria-label="MCC AI Guide" aria-hidden="true">'
    +'<header class="mcc-guide__header"><img class="mcc-guide__face" src="'+new URL('assets/mac-avatar.webp',root).href+'" alt=""><div class="mcc-guide__title"><strong>Mac · MCC AI Guide</strong><small><span class="mcc-guide__status-dot"></span><span data-guide-status aria-live="polite">Ready to help</span></small></div><button class="mcc-guide__close" type="button" aria-label="Close Mac AI Guide">×</button></header>'
    +'<div class="mcc-guide__context">CURRENT LOCATION · <strong data-guide-context>'+escapeHtml(contextLabel())+'</strong></div>'
    +'<div class="mcc-guide__tabs" role="tablist"><button class="mcc-guide__tab is-active" data-mode="navigator" type="button">🧭 Navigator</button><button class="mcc-guide__tab" data-mode="coach" type="button">◉ Coach</button><button class="mcc-guide__tab" data-mode="builder" type="button">⌘ Builder</button></div>'
    +'<div class="mcc-guide__welcome"><p><strong>Hello, I’m Mac.</strong><span>Tell me what you want to accomplish. I’ll point you toward the best MCC activity.</span></p></div>'
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
  function score(item,words){var hay=(item.title+' '+item.zone+' '+item.type+' '+item.description+' '+item.keywords+' '+item.audience.join(' ')).toLowerCase(),score=0;words.forEach(function(w){if(w.length>2&&hay.indexOf(w)>=0)score+=1;});return score;}
  function recommend(query){
    var q=query.toLowerCase(),words=q.split(/[^a-z0-9]+/).filter(Boolean),picked;
    if(mode==='builder'||/build|code|prototype|automation|tool/.test(q))picked=content.find(function(x){return x.id==='workshop';});
    else if(mode==='coach'&&current.path)picked=current;
    else if(/safe|risk|private|sensitive|decision/.test(q))picked=content.find(function(x){return x.id==='scenarios';});
    else if(/prompt|context/.test(q))picked=content.find(function(x){return x.id==='context-lab';});
    else if(/verify|source|fact|accur/.test(q))picked=content.find(function(x){return x.id==='verification';});
    else picked=content.map(function(x){return {item:x,score:score(x,words)};}).sort(function(a,b){return b.score-a.score;})[0].item;
    var why=mode==='coach'&&current.path?'Stay with the current activity and use its prompts as checkpoints. If you are stuck, review the concept before revealing the answer.':'This is the closest match in the MCC learning environment based on your goal.';
    var card=document.createElement('div');card.className='mcc-guide__recommendation';card.innerHTML='<small>'+escapeHtml(picked.zone)+' · '+escapeHtml(picked.duration)+'</small><strong>'+escapeHtml(picked.title)+'</strong><p>'+escapeHtml(why)+'</p><a href="'+new URL(picked.path,root).href+'">Open '+escapeHtml(picked.title)+' →</a>';messages.appendChild(card);messages.scrollTop=messages.scrollHeight;setState('success','Recommendation ready');window.setTimeout(function(){setState('',modeName());},1100);
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
