(function () {
'use strict';

var own = Array.prototype.slice.call(document.scripts).find(function (script) {
return /mac-guide\.js(?:\?|$)/.test(script.src);
});
if (document.querySelector('.mac-guide')) return;

var siteRoot = own
? new URL('../', own.src)
: new URL(document.body.dataset.macGuideRoot || '../', location.href);
var asset = function (path) { return new URL(path, siteRoot).href; };
var poseUrls = {
wave: asset('assets/mac-guide.webp'),
neutral: asset('assets/mac-poses/idle-neutral.webp'),
thinking: asset('assets/mac-poses/idle-thinking.webp'),
confident: asset('assets/mac-poses/idle-confident.webp'),
patient: asset('assets/mac-poses/idle-patient.webp'),
casual: asset('assets/mac-poses/idle-casual.webp'),
seated: asset('assets/mac-poses/idle-seated.webp'),
hover: asset('assets/mac-poses/reaction-hover.webp'),
working: asset('assets/mac-poses/working-laptop.webp')
};
var idleChoices = [
{ name: 'thinking', weight: 45 },
{ name: 'casual', weight: 25 },
{ name: 'patient', weight: 15 },
{ name: 'confident', weight: 10 },
{ name: 'seated', weight: 5 }
];
var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var positionKey = 'mccMacPositionV1';
var greetingKey = 'mccMacGreetedV1';
var modeKey = 'mccMacModeV1';

var guide = document.createElement('aside');
guide.className = 'mac-guide';
guide.setAttribute('aria-label', 'Mac, MCC AI Guide');
guide.innerHTML = [
'<button class="mac-guide__launcher" type="button" aria-label="Ask Mac, the draggable MCC site navigator" aria-expanded="false">',
'<span class="mac-guide__label">Ask Mac<small>Drag me · click for help</small></span>',
'<img class="mac-guide__character" src="' + poseUrls.wave + '" alt="" draggable="false">',
'</button>',
'<section class="mac-guide__panel" role="dialog" aria-modal="false" aria-labelledby="mac-guide-title">',
'<header class="mac-guide__head">',
'<img class="mac-guide__avatar" src="' + poseUrls.wave + '" alt="">',
'<div class="mac-guide__title"><strong id="mac-guide-title">Mac · MCC AI Guide</strong><span>Working on it</span></div>',
'<button class="mac-guide__close" type="button" aria-label="Close Mac AI Guide">×</button>',
'</header>',
'<div class="mac-guide__modes" role="tablist" aria-label="Choose how Mac should help">',
'<button class="mac-guide__mode" type="button" role="tab" aria-selected="true" data-mac-mode="navigator"><span>🧭</span>Navigator</button>',
'<button class="mac-guide__mode" type="button" role="tab" aria-selected="false" data-mac-mode="coach"><span>◉</span>Coach</button>',
'<button class="mac-guide__mode" type="button" role="tab" aria-selected="false" data-mac-mode="builder"><span>⌘</span>Builder</button>',
'</div>',
'<div class="mac-guide__body">',
'<div class="mac-guide__location">Current location · <strong data-mac-location>MCC AI Professional Development</strong></div>',
'<div class="mac-guide__context" data-mac-context></div>',
'<p class="mac-guide__intro" data-mac-intro></p>',
'<div class="mac-guide__quick" aria-label="Quick questions" data-mac-quick></div>',
'<div class="mac-guide__results" aria-live="polite" data-mac-results></div>',
'</div>',
'<form class="mac-guide__form">',
'<label class="sr-only" for="mac-guide-input">Ask Mac what you want to find</label>',
'<input class="mac-guide__input" id="mac-guide-input" type="search" placeholder="What would you like to find?" autocomplete="off">',
'<button class="mac-guide__send" type="submit">Ask</button>',
'</form>',
'<div class="mac-guide__note">Mac uses the MCC learning catalog in this browser. Your question is not sent to an outside AI service.</div>',
'</section>'
].join('');
document.body.appendChild(guide);

var launcher = guide.querySelector('.mac-guide__launcher');
var character = guide.querySelector('.mac-guide__character');
var labelChip = guide.querySelector('.mac-guide__label');
var panel = guide.querySelector('.mac-guide__panel');
var close = guide.querySelector('.mac-guide__close');
var input = guide.querySelector('.mac-guide__input');
var form = guide.querySelector('.mac-guide__form');
var results = guide.querySelector('[data-mac-results]');
var intro = guide.querySelector('[data-mac-intro]');
var quick = guide.querySelector('[data-mac-quick]');
var context = guide.querySelector('[data-mac-context]');
var locationLabel = guide.querySelector('[data-mac-location]');
var statusLabel = guide.querySelector('.mac-guide__title span');
var modeButtons = Array.prototype.slice.call(guide.querySelectorAll('[data-mac-mode]'));
var catalog = window.MCC_CONTENT || [];
var currentMode = 'navigator';
var idleTimer = null;
var poseHoldTimer = null;
var poseSwapTimer = null;
var hoverTimer = null;
var hoverReturnTimer = null;
var closeTimer = null;
var celebrateTimer = null;
var celebrateHoldTimer = null;
var celebrateLabelHTML = labelChip ? labelChip.innerHTML : '';
var recentIdlePoses = [];
var idleMomentCount = 0;
var pendingPose = null;
var isHovering = false;
var drag = null;
var suppressClick = false;

Object.keys(poseUrls).forEach(function (name) {
var preload = new Image();
preload.src = poseUrls[name];
});

function esc(value) {
return String(value).replace(/[&<>\"]/g, function (characterToEscape) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[characterToEscape];
});
}

function randomBetween(minimum, maximum) {
return Math.round(minimum + Math.random() * (maximum - minimum));
}

function clearTimer(timer) {
if (timer) window.clearTimeout(timer);
return null;
}

function setPose(name, immediate) {
if (!poseUrls[name]) return;
poseSwapTimer = clearTimer(poseSwapTimer);
character.classList.remove('is-changing');
pendingPose = null;
if (character.dataset.pose === name) return;
if (immediate || reducedMotion) {
character.src = poseUrls[name];
character.dataset.pose = name;
return;
}
pendingPose = name;
character.classList.add('is-changing');
poseSwapTimer = window.setTimeout(function () {
if (pendingPose !== name) return;
character.src = poseUrls[name];
character.dataset.pose = name;
character.classList.remove('is-changing');
pendingPose = null;
poseSwapTimer = null;
}, 180);
}

function stopIdle() {
idleTimer = clearTimer(idleTimer);
poseHoldTimer = clearTimer(poseHoldTimer);
}

function chooseIdlePose() {
var available = idleChoices.filter(function (choice) {
return recentIdlePoses.indexOf(choice.name) === -1;
});
if (!available.length) available = idleChoices.slice();
var total = available.reduce(function (sum, choice) { return sum + choice.weight; }, 0);
var draw = Math.random() * total;
var chosen = available[available.length - 1].name;
available.some(function (choice) {
draw -= choice.weight;
if (draw > 0) return false;
chosen = choice.name;
return true;
});
recentIdlePoses.push(chosen);
if (recentIdlePoses.length > 2) recentIdlePoses.shift();
return chosen;
}

function nextIdleDelay() {
idleMomentCount += 1;
if (idleMomentCount % 3 === 0 || Math.random() < 0.18) {
return randomBetween(45000, 90000);
}
return randomBetween(18000, 45000);
}

function startIdle(delay) {
stopIdle();
if (reducedMotion || guide.classList.contains('is-open') || document.hidden) return;
idleTimer = window.setTimeout(function () {
idleTimer = null;
if (isHovering || drag || document.hidden || guide.classList.contains('is-open')) {
startIdle(randomBetween(12000, 24000));
return;
}
setPose(chooseIdlePose());
poseHoldTimer = window.setTimeout(function () {
poseHoldTimer = null;
if (!isHovering && !drag && !guide.classList.contains('is-open')) setPose('neutral');
startIdle();
}, randomBetween(4000, 9000));
}, delay === undefined ? nextIdleDelay() : delay);
}

function activityHere() {
var marked = document.querySelector('[data-mcc-activity]');
var id = document.body.dataset.mccActivity || (marked && marked.dataset.mccActivity);
return catalog.find(function (item) { return item.id === id; });
}

function revealForHub() {
var hub = document.getElementById('hub');
if (!hub) return;
guide.hidden = !hub.classList.contains('on');
var observer = new MutationObserver(function () {
guide.hidden = !hub.classList.contains('on');
});
observer.observe(hub, { attributes: true, attributeFilter: ['class'] });
}

function clamp(value, minimum, maximum) {
return Math.min(Math.max(value, minimum), maximum);
}

function moveTo(left, top) {
var width = launcher.offsetWidth;
var height = launcher.offsetHeight;
var safeLeft = clamp(left, 8, Math.max(8, window.innerWidth - width - 8));
var safeTop = clamp(top, 8, Math.max(8, window.innerHeight - height - 8));
guide.classList.add('is-positioned');
guide.style.left = safeLeft + 'px';
guide.style.top = safeTop + 'px';
guide.style.right = 'auto';
guide.style.bottom = 'auto';
if (guide.classList.contains('is-open')) positionPanel();
}

function savePosition() {
try {
localStorage.setItem(positionKey, JSON.stringify({
x: parseFloat(guide.style.left),
y: parseFloat(guide.style.top)
}));
} catch (error) {}
}

function restorePosition() {
try {
var stored = JSON.parse(localStorage.getItem(positionKey));
if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
moveTo(stored.x, stored.y);
}
} catch (error) {}
}

function positionPanel() {
if (!guide.classList.contains('is-open') || window.innerWidth <= 600) return;
var macRect = launcher.getBoundingClientRect();
var panelRect = panel.getBoundingClientRect();
var gap = 14;
var left = macRect.left > window.innerWidth / 2
? macRect.left - panelRect.width - gap
: macRect.right + gap;
var top = macRect.bottom - panelRect.height;
panel.style.right = 'auto';
panel.style.bottom = 'auto';
panel.style.left = clamp(left, 12, window.innerWidth - panelRect.width - 12) + 'px';
panel.style.top = clamp(top, 12, window.innerHeight - panelRect.height - 12) + 'px';
}

function openGuide() {
closeTimer = clearTimer(closeTimer);
hoverTimer = clearTimer(hoverTimer);
hoverReturnTimer = clearTimer(hoverReturnTimer);
guide.classList.add('is-open');
launcher.setAttribute('aria-expanded', 'true');
statusLabel.textContent = 'Ready to help';
stopIdle();
setPose('working');
window.requestAnimationFrame(function () {
positionPanel();
input.focus();
});
}

function shutGuide() {
guide.classList.remove('is-open');
launcher.setAttribute('aria-expanded', 'false');
panel.style.left = '';
panel.style.top = '';
panel.style.right = '';
panel.style.bottom = '';
statusLabel.textContent = 'Ready when you are';
closeTimer = window.setTimeout(function () {
closeTimer = null;
if (!guide.classList.contains('is-open') && !isHovering) {
setPose('neutral');
startIdle(randomBetween(18000, 36000));
}
}, reducedMotion ? 0 : randomBetween(500, 850));
launcher.focus();
}

/* Reacts to real events instead of only idle randomness — currently the
'mcc:activity-complete' signal that activity pages already dispatch when a
learner finishes something (Find Your Ten Hours' plan, The Safe
Hypothetical's copy button, and so on). Mac holds a confident pose and, if
his panel is closed, briefly swaps his floating label to a short
acknowledgement so the reaction is visible without anyone opening him. */
function celebrate() {
if (guide.hidden) return;
celebrateTimer = clearTimer(celebrateTimer);
celebrateHoldTimer = clearTimer(celebrateHoldTimer);
stopIdle();
setPose('confident');
guide.classList.add('is-celebrating');
if (guide.classList.contains('is-open')) {
statusLabel.textContent = 'Nice — that’s progress logged';
celebrateHoldTimer = window.setTimeout(function () {
celebrateHoldTimer = null;
if (guide.classList.contains('is-open')) statusLabel.textContent = 'Ready to help';
}, 4200);
} else if (labelChip) {
labelChip.innerHTML = 'Nice work!<small>That’s progress logged</small>';
celebrateHoldTimer = window.setTimeout(function () {
celebrateHoldTimer = null;
labelChip.innerHTML = celebrateLabelHTML;
}, 4200);
}
celebrateTimer = window.setTimeout(function () {
celebrateTimer = null;
guide.classList.remove('is-celebrating');
if (!isHovering && !drag && !guide.classList.contains('is-open')) {
setPose('neutral');
startIdle(randomBetween(18000, 36000));
}
}, 4600);
}

function words(value) {
return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function score(item, tokens) {
var haystack = [item.title, item.description, item.keywords, item.zone, item.type, item.level, item.duration, item.audience.join(' ')].join(' ').toLowerCase();
var total = 0;
tokens.forEach(function (token) {
if (haystack.indexOf(token) > -1) total += token.length > 6 ? 4 : 2;
if (item.title.toLowerCase().indexOf(token) > -1) total += 4;
});
if (tokens.indexOf('new') > -1 || tokens.indexOf('beginner') > -1) {
if (item.level === 'Beginner') total += 5;
if (item.id === 'llm-works') total += 12;
}
if (tokens.indexOf('15') > -1 && /^(8|10|12|15)/.test(item.duration)) total += 4;
return total;
}

function itemById(id) {
return catalog.find(function (item) { return item.id === id; });
}

function itemLink(item, label) {
if (!item) return '';
return '<a class="mac-guide__action-link" href="' + new URL(item.path, siteRoot).href + '">' + esc(label || item.cta || 'Open activity') + ' →</a>';
}

function message(eyebrow, title, body, link) {
results.innerHTML = '<article class="mac-guide__answer"><small>' + esc(eyebrow) + '</small><strong>' + esc(title) + '</strong><p>' + esc(body) + '</p>' + (link || '') + '</article>';
}

function renderContext() {
var here = activityHere();
if (!here) {
context.innerHTML = '<span>Site overview</span><strong>Choose a path or tell Mac your goal.</strong>';
return;
}
var prerequisites = (here.prerequisites || []).map(itemById).filter(Boolean);
context.innerHTML = '<span>' + esc(here.zone + ' · ' + here.duration + ' · ' + here.level) + '</span><strong>' + esc(here.title) + '</strong>' +
(prerequisites.length ? '<em>Builds on ' + prerequisites.map(function (item) { return esc(item.title); }).join(', ') + '</em>' : '<em>No prerequisite required</em>');
}

function quickButton(label, action, query) {
return '<button class="mac-guide__chip" type="button" data-action="' + esc(action) + '"' + (query ? ' data-query="' + esc(query) + '"' : '') + '>' + esc(label) + '</button>';
}

function renderMode(mode, preserveResults) {
currentMode = mode;
try { window.sessionStorage.setItem(modeKey, mode); } catch (error) {}
modeButtons.forEach(function (button) {
var selected = button.dataset.macMode === mode;
button.setAttribute('aria-selected', String(selected));
button.tabIndex = selected ? 0 : -1;
});
renderContext();
var here = activityHere();
if (mode === 'coach') {
intro.textContent = here
? 'I know which activity you are using. Ask for a staged hint, a plain-language explanation, or the next learning move.'
: 'Open an activity and I can coach you through it without simply giving away the answer.';
quick.innerHTML = quickButton('Give me a hint', 'hint') + quickButton('Explain this', 'explain') + quickButton('Learning goals', 'objectives') + quickButton('What next?', 'next');
input.placeholder = 'Ask about this activity…';
if (!preserveResults) message('Coach mode', here ? 'Let’s work through it' : 'Choose an activity first', here ? 'I’ll use this activity’s learning goals and guidance to help you reason through the work.' : 'Try How an LLM Works for the essentials, or ask Navigator to find the right starting point.', here ? '' : itemLink(itemById('llm-works'), 'Start with the essentials'));
} else if (mode === 'builder') {
intro.textContent = 'Turn an idea into a small, reviewable plan with a clear goal, first step, safeguard, and starter prompt.';
quick.innerHTML = quickButton('Define the goal', 'build-focus') + quickButton('Choose a first step', 'build-step') + quickButton('Set safeguards', 'build-safe') + quickButton('Draft a prompt', 'build-prompt');
input.placeholder = 'What would you like to build?';
if (!preserveResults) message('Builder mode', here ? 'Build from this activity' : 'Start with a narrow outcome', here && here.builder ? here.builder.focus : 'Describe one user, one repeated task, and one useful output. Mac will connect that idea to the closest MCC build resource.', itemLink(itemById('workshop'), 'Open the workshop'));
} else {
intro.textContent = 'Tell me what you want to learn or accomplish. I’ll point you toward the most useful MCC activity.';
quick.innerHTML = quickButton('New to AI', 'search', 'I am new to AI') + quickButton('Faculty resources', 'search', 'faculty teaching') + quickButton('Check an answer', 'search', 'verification accuracy') + quickButton('Under 15 minutes', 'search', '15 minute beginner') + quickButton('Build something', 'search', 'build a tool');
input.placeholder = 'What would you like to find?';
if (!preserveResults) results.innerHTML = '<div class="mac-guide__empty">Choose a quick question, or describe what you need help finding.</div>';
}
}

function coachAction(action) {
var here = activityHere();
if (!here) {
message('Coach mode', 'I need an activity for context', 'Open an activity first, then Mac can use its learning goals, hints, and recommended next step.', itemLink(itemById('llm-works'), 'Start with the essentials'));
return;
}
if (action === 'objectives') {
results.innerHTML = '<article class="mac-guide__answer"><small>Learning goals</small><strong>' + esc(here.title) + '</strong><ul>' + (here.objectives || []).map(function (objective) { return '<li>' + esc(objective) + '</li>'; }).join('') + '</ul></article>';
statusLabel.textContent = 'Goals in view';
return;
}
var labels = {hint:'A useful hint',explain:'The idea underneath',next:'Your next move'};
var text = here.coach && here.coach[action];
var related = action === 'next' && here.related && itemById(here.related[0]);
message('Coach · ' + here.title, labels[action] || 'Coaching note', text || here.description, related ? itemLink(related, 'Continue to ' + related.title) : '');
statusLabel.textContent = action === 'hint' ? 'A hint—not the answer' : 'Context ready';
}

function builderAction(action) {
var here = activityHere();
var source = here && here.builder ? here : itemById('workshop');
var builder = source && source.builder;
var map = {
'build-focus':['Define the outcome','focus'],
'build-step':['Make the first move','firstStep'],
'build-safe':['Protect the boundary','safeguard'],
'build-prompt':['Starter prompt','prompt']
};
var choice = map[action] || map['build-focus'];
message('Builder · ' + (here ? here.title : 'MCC tool planning'), choice[0], builder ? builder[choice[1]] : 'Begin with one user, one task, and one reviewable output.', source ? itemLink(source, source.id === 'workshop' ? 'Build the full plan' : 'Open this activity') : '');
statusLabel.textContent = action === 'build-prompt' ? 'Prompt drafted locally' : 'Build step ready';
}

function handleAction(action, query) {
if (action === 'search') {
input.value = query || '';
find(input.value);
} else if (/^build-/.test(action)) {
builderAction(action);
} else {
coachAction(action);
}
}

function find(query) {
catalog = window.MCC_CONTENT || catalog;
var tokens = words(query);
var ranked = catalog.map(function (item, index) {
return { item: item, score: score(item, tokens), index: index };
}).filter(function (row) {
return row.score > 0;
}).sort(function (a, b) {
return b.score - a.score || a.index - b.index;
}).slice(0, 3);

if (!ranked.length) {
results.innerHTML = '<div class="mac-guide__empty">I could not find a close match. Try a topic such as prompting, verification, privacy, faculty, productivity, or building tools.</div>';
statusLabel.textContent = 'Try another topic';
return;
}

results.innerHTML = ranked.map(function (row) {
var item = row.item;
return '<a class="mac-guide__result" href="' + new URL(item.path, siteRoot).href + '"><small>' + esc(item.zone) + ' · ' + esc(item.duration) + '</small><strong>' + esc(item.title) + '</strong><span>' + esc(item.description) + '</span></a>';
}).join('');
statusLabel.textContent = ranked.length === 1 ? 'I found a path' : 'I found a few paths';
}

function refreshContext() {
catalog = window.MCC_CONTENT || catalog;
var here = activityHere();
locationLabel.textContent = here ? here.title : 'MCC AI Professional Development';
renderContext();
}

launcher.addEventListener('pointerdown', function (event) {
if (event.button !== undefined && event.button !== 0) return;
var rect = launcher.getBoundingClientRect();
drag = {
pointerId: event.pointerId,
startX: event.clientX,
startY: event.clientY,
left: rect.left,
top: rect.top,
moved: false
};
launcher.setPointerCapture(event.pointerId);
});

launcher.addEventListener('pointermove', function (event) {
if (!drag || drag.pointerId !== event.pointerId) return;
var deltaX = event.clientX - drag.startX;
var deltaY = event.clientY - drag.startY;
if (!drag.moved && Math.hypot(deltaX, deltaY) < 6) return;
drag.moved = true;
guide.classList.add('is-dragging');
stopIdle();
moveTo(drag.left + deltaX, drag.top + deltaY);
});

function finishDrag(event) {
if (!drag || drag.pointerId !== event.pointerId) return;
if (launcher.hasPointerCapture(event.pointerId)) launcher.releasePointerCapture(event.pointerId);
if (drag.moved) {
suppressClick = true;
savePosition();
window.setTimeout(function () { suppressClick = false; }, 0);
}
guide.classList.remove('is-dragging');
drag = null;
if (!guide.classList.contains('is-open')) {
setPose('neutral');
startIdle(randomBetween(18000, 36000));
}
}

launcher.addEventListener('pointerup', finishDrag);
launcher.addEventListener('pointercancel', finishDrag);
launcher.addEventListener('dragstart', function (event) { event.preventDefault(); });

launcher.addEventListener('click', function () {
if (suppressClick) return;
if (guide.classList.contains('is-open')) shutGuide();
else openGuide();
});

launcher.addEventListener('pointerenter', function (event) {
if (event.pointerType && event.pointerType !== 'mouse') return;
isHovering = true;
hoverReturnTimer = clearTimer(hoverReturnTimer);
stopIdle();
hoverTimer = window.setTimeout(function () {
hoverTimer = null;
if (isHovering && !guide.classList.contains('is-open') && !drag) setPose('hover');
}, 150);
});

launcher.addEventListener('pointerleave', function () {
isHovering = false;
hoverTimer = clearTimer(hoverTimer);
if (guide.classList.contains('is-open') || drag) return;
hoverReturnTimer = window.setTimeout(function () {
hoverReturnTimer = null;
if (!isHovering && !guide.classList.contains('is-open') && !drag) {
setPose('neutral');
startIdle(randomBetween(18000, 36000));
}
}, randomBetween(400, 700));
});

launcher.addEventListener('keydown', function (event) {
if (!event.shiftKey || !/^Arrow/.test(event.key)) return;
event.preventDefault();
var rect = launcher.getBoundingClientRect();
var step = event.altKey ? 32 : 12;
var left = rect.left;
var top = rect.top;
if (event.key === 'ArrowLeft') left -= step;
if (event.key === 'ArrowRight') left += step;
if (event.key === 'ArrowUp') top -= step;
if (event.key === 'ArrowDown') top += step;
moveTo(left, top);
savePosition();
});

close.addEventListener('click', shutGuide);
modeButtons.forEach(function (button, index) {
button.addEventListener('click', function () {
renderMode(button.dataset.macMode);
statusLabel.textContent = button.textContent.trim() + ' mode';
input.focus();
});
button.addEventListener('keydown', function (event) {
if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
event.preventDefault();
var nextIndex = event.key === 'ArrowRight' ? (index + 1) % modeButtons.length : (index + modeButtons.length - 1) % modeButtons.length;
modeButtons[nextIndex].focus();
modeButtons[nextIndex].click();
});
});
quick.addEventListener('click', function (event) {
var button = event.target.closest('[data-action]');
if (!button) return;
handleAction(button.dataset.action, button.dataset.query);
});
form.addEventListener('submit', function (event) {
event.preventDefault();
var query = input.value.trim();
if (currentMode === 'navigator') {
find(query);
return;
}
var tokens = words(query);
if (currentMode === 'coach') {
if (tokens.some(function (token) { return ['hint','stuck','help'].indexOf(token) > -1; })) coachAction('hint');
else if (tokens.some(function (token) { return ['next','after','continue'].indexOf(token) > -1; })) coachAction('next');
else if (tokens.some(function (token) { return ['goal','goals','objective','objectives','learn'].indexOf(token) > -1; })) coachAction('objectives');
else coachAction('explain');
return;
}
if (tokens.some(function (token) { return ['safe','safety','risk','privacy','boundary','safeguard'].indexOf(token) > -1; })) builderAction('build-safe');
else if (tokens.some(function (token) { return ['prompt','draft','instruction'].indexOf(token) > -1; })) builderAction('build-prompt');
else if (tokens.some(function (token) { return ['first','next','start','step'].indexOf(token) > -1; })) builderAction('build-step');
else builderAction('build-focus');
});
document.addEventListener('keydown', function (event) {
if (event.key === 'Escape' && guide.classList.contains('is-open')) shutGuide();
});
document.addEventListener('mcc:activity-complete', celebrate);
document.addEventListener('visibilitychange', function () {
if (document.hidden) stopIdle();
else if (!guide.classList.contains('is-open') && !isHovering) {
setPose('neutral');
startIdle(randomBetween(18000, 36000));
}
});
window.addEventListener('resize', function () {
if (guide.classList.contains('is-positioned')) {
moveTo(parseFloat(guide.style.left) || 8, parseFloat(guide.style.top) || 8);
}
positionPanel();
});

function initial() {
refreshContext();
if (!catalog.length) (function waitForCatalog(attempt) {
window.setTimeout(function () {
catalog = window.MCC_CONTENT || catalog;
if (catalog.length || attempt >= 5) {
refreshContext();
renderMode(currentMode);
} else {
waitForCatalog(attempt + 1);
}
}, 120 * attempt);
})(1);
try {
var storedMode = window.sessionStorage.getItem(modeKey);
if (['navigator','coach','builder'].indexOf(storedMode) > -1) currentMode = storedMode;
} catch (error) {}
renderMode(currentMode);
revealForHub();
restorePosition();
var shouldWave = false;
try {
shouldWave = !window.sessionStorage.getItem(greetingKey);
window.sessionStorage.setItem(greetingKey, '1');
} catch (error) {
shouldWave = true;
}
if (reducedMotion || !shouldWave) {
setPose('neutral', true);
startIdle();
return;
}
character.dataset.pose = 'wave';
window.setTimeout(function () {
if (!guide.classList.contains('is-open') && !isHovering) setPose('neutral');
startIdle();
}, randomBetween(1800, 2400));
}

initial();
})();
