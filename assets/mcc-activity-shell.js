(function(){
  'use strict';
  var body=document.body;
  var existing=document.querySelector('[data-mcc-activity]');
  var id=(existing&&existing.dataset.mccActivity)||body.dataset.mccActivity;
  var catalog=window.MCC_CONTENT||[];
  var activity=catalog.find(function(item){return item.id===id;});
  if(!activity)return;
  body.classList.add('mcc-shell-active');
  function esc(value){return String(value).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}

  if(!document.querySelector('.mcc-activity-bar')){
    var bar=document.createElement('header');bar.className='mcc-activity-bar';
    bar.innerHTML='<a class="mcc-activity-brand" href="../#hub" aria-label="MCC AI Professional Development home"><span class="mcc-activity-brand__mark">MCC</span><span><strong>AI Professional Development</strong><small>Learn · Practice · Build · Use</small></span></a><nav class="mcc-activity-nav" aria-label="Activity navigation"><a href="../#featured">Resources</a><a href="../#pathways">Pathways</a><a href="../#my-learning">My Learning</a><a class="mcc-activity-home" href="../#hub">Hub</a></nav>';
    body.insertBefore(bar,body.firstChild);
  }

  var hero=existing;
  var mode=body.dataset.activityShellMode||'full';
  if(!hero&&mode!=='nav-only'){
    var mount=document.querySelector('[data-activity-shell-mount]');
    if(mount){
      hero=document.createElement('section');hero.className='mcc-activity-hero';hero.dataset.mccActivity=id;hero.dataset.activityTarget=body.dataset.activityTarget||'';
      hero.innerHTML='<div class="mcc-activity-identity"><div class="mcc-activity-icon" aria-hidden="true">'+esc(activity.icon||'◇')+'</div><div><div class="mcc-activity-kicker">'+esc(activity.type)+' · '+esc(activity.zone)+'</div><h1>'+esc(activity.title)+'</h1><p class="mcc-activity-summary">'+esc(activity.description)+'</p><div class="mcc-activity-meta" aria-label="Activity details"><span>◷ '+esc(activity.duration)+'</span><span>'+esc(activity.level)+'</span><span>'+esc(activity.type)+'</span><span>'+esc(activity.audience.join(' · '))+'</span></div><div class="mcc-activity-actions"><button class="mcc-activity-action mcc-activity-action--primary" type="button" data-activity-start>Start activity</button><button class="mcc-activity-action" type="button" data-activity-save aria-pressed="false">Save for later</button></div></div></div><aside class="mcc-activity-overview"><small>You\'ll learn to</small><h2>Build a practical AI habit</h2><ul>'+((activity.objectives||[]).map(function(item){return '<li>'+esc(item)+'</li>';}).join(''))+'</ul></aside>';
      mount.replaceWith(hero);
    }
  }

  var progressKey='mcc-activity-progress-v1',savedKey='mcc-saved-activities-v1';
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch(e){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}}
  function progress(status){var state=read(progressKey,{});state[id]={status:status,updatedAt:Date.now()};write(progressKey,state);write('mcc-last-page-v1',{path:activity.path,title:activity.title,at:Date.now()});}
  if(hero){
    var start=hero.querySelector('[data-activity-start]'),save=hero.querySelector('[data-activity-save]');
    var selector=hero.dataset.activityTarget||body.dataset.activityTarget||'';var target=selector?document.querySelector(selector):null;
    var saved=read(savedKey,[]);
    function paintSaved(){var on=saved.indexOf(id)>-1;save.classList.toggle('is-saved',on);save.textContent=on?'Saved for later ✓':'Save for later';save.setAttribute('aria-pressed',String(on));}
    paintSaved();
    start.addEventListener('click',function(){progress('started');if(target)target.scrollIntoView({behavior:'smooth',block:'start'});});
    save.addEventListener('click',function(){var at=saved.indexOf(id);if(at>-1)saved.splice(at,1);else saved.push(id);write(savedKey,saved);paintSaved();});
    document.addEventListener('mcc:activity-complete',function(){progress('completed');start.textContent='Activity completed ✓';});
  }

  if(mode!=='nav-only'){
    var related=document.querySelector('[data-related-activities]');
    if(!related){
      var section=document.createElement('section');section.className='mcc-related mcc-shell-standalone';section.setAttribute('aria-label','Related activities');section.innerHTML='<div class="mcc-related__heading"><div><small>Keep learning</small><h2>Related activities</h2></div><a href="../#all-activities">View all activities →</a></div><div class="mcc-related__grid" data-related-activities></div>';
      var main=document.querySelector('main');if(main)main.appendChild(section);else body.appendChild(section);related=section.querySelector('[data-related-activities]');
    }
    var items=(activity.related||[]).map(function(relatedId){return catalog.find(function(item){return item.id===relatedId;});}).filter(Boolean);
    related.innerHTML=items.map(function(item){return '<a class="mcc-related__card" href="../'+esc(item.path)+'"><small>'+esc(item.zone)+' · '+esc(item.duration)+'</small><strong>'+esc(item.title)+'</strong><span>'+esc(item.description)+'</span></a>';}).join('');
  }
})();
