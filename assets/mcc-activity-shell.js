(function(){
  'use strict';
  var hero=document.querySelector('[data-mcc-activity]');
  if(!hero)return;
  var id=hero.dataset.mccActivity;
  var catalog=window.MCC_CONTENT||[];
  var activity=catalog.find(function(item){return item.id===id;});
  if(!activity)return;

  var progressKey='mcc-activity-progress-v1';
  var savedKey='mcc-saved-activities-v1';
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch(e){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}}
  function progress(status){var state=read(progressKey,{});state[id]={status:status,updatedAt:Date.now()};write(progressKey,state);write('mcc-last-page-v1',{path:activity.path,title:activity.title,at:Date.now()});}

  var start=document.querySelector('[data-activity-start]');
  var save=document.querySelector('[data-activity-save]');
  var target=document.querySelector(hero.dataset.activityTarget||'#lab');
  var saved=read(savedKey,[]);
  function paintSaved(){var on=saved.indexOf(id)>-1;save.classList.toggle('is-saved',on);save.textContent=on?'Saved for later ✓':'Save for later';save.setAttribute('aria-pressed',String(on));}
  paintSaved();
  start.addEventListener('click',function(){progress('started');if(target)target.scrollIntoView({behavior:'smooth',block:'start'});});
  save.addEventListener('click',function(){var at=saved.indexOf(id);if(at>-1)saved.splice(at,1);else saved.push(id);write(savedKey,saved);paintSaved();});
  document.addEventListener('mcc:activity-complete',function(){progress('completed');start.textContent='Activity completed ✓';});

  var related=document.querySelector('[data-related-activities]');
  if(related){
    var items=(activity.related||[]).map(function(relatedId){return catalog.find(function(item){return item.id===relatedId;});}).filter(Boolean);
    related.innerHTML=items.map(function(item){return '<a class="mcc-related__card" href="../'+item.path+'"><small>'+item.zone+' · '+item.duration+'</small><strong>'+item.title+'</strong><span>'+item.description+'</span></a>';}).join('');
  }
})();
