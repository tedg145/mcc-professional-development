(function () {
'use strict';

var own = Array.prototype.slice.call(document.scripts).find(function (script) {
return /mac-guide\.js(?:\?|$)/.test(script.src);
});
if (document.querySelector('.mac-guide')) return;

var siteRoot = own
? new URL('../', own.src)
: new URL(document.body.dataset.macGuideRoot || '../', location.href);
var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var positionKey = 'mccMacPositionV1';
var greetingKey = 'mccMacGreetedDateV1';
var modeKey = 'mccMacModeV1';
var nudgeShownKey = 'mccMacNudgedV1';
var introClickKey = 'mccMacIntroducedV1';

/* A rigged, part-based character instead of a set of swapped illustrations —
each limb is its own group with its own rotation pivot, so moving between
"poses" is a real interpolated motion (CSS easing a rotation/translate)
rather than a crossfade between two unrelated pictures. Colors match the
site's own tokens rather than a separate art palette. */
/* Shared gradient/filter defs — gives the flat vector shapes soft volume
(radial highlights, cylindrical shading) and a bit of cast shadow between
layers, aiming for the glossy 3D-rendered look of the original art while
keeping every shape a single, cheaply-animatable path. */
function macDefsMarkup() {
return '<defs>' +
'<radialGradient id="mgSkin" cx="38%" cy="28%" r="80%"><stop offset="0%" stop-color="#f8d3a6"/><stop offset="55%" stop-color="#e7ad82"/><stop offset="100%" stop-color="#bd815a"/></radialGradient>' +
'<linearGradient id="mgBeard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f6924c"/><stop offset="55%" stop-color="#e0632a"/><stop offset="100%" stop-color="#96370f"/></linearGradient>' +
'<linearGradient id="mgBeardDeep" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#cf6530"/><stop offset="100%" stop-color="#87310d"/></linearGradient>' +
'<linearGradient id="mgTorso" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0%" stop-color="#2c5484"/><stop offset="50%" stop-color="#173355"/><stop offset="100%" stop-color="#071322"/></linearGradient>' +
'<linearGradient id="mgTorsoDeep" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#152a46"/><stop offset="100%" stop-color="#040a14"/></linearGradient>' +
'<radialGradient id="mgShield" cx="35%" cy="26%" r="85%"><stop offset="0%" stop-color="#ffffff"/><stop offset="45%" stop-color="#dee4ea"/><stop offset="100%" stop-color="#87939f"/></radialGradient>' +
'<radialGradient id="mgShoe" cx="35%" cy="20%" r="90%"><stop offset="0%" stop-color="#463523"/><stop offset="100%" stop-color="#0c0805"/></radialGradient>' +
'<radialGradient id="mgGlove" cx="38%" cy="26%" r="85%"><stop offset="0%" stop-color="#ffffff"/><stop offset="55%" stop-color="#f2eee3"/><stop offset="100%" stop-color="#cdc6b3"/></radialGradient>' +
'<linearGradient id="mgSockWhite" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="#f0ece0"/><stop offset="100%" stop-color="#cfc8b6"/></linearGradient>' +
'<pattern id="mgTartan" width="14" height="14" patternUnits="userSpaceOnUse">' +
'<rect width="14" height="14" fill="#8a1c24"/>' +
'<rect width="14" height="4.4" y="0" fill="#1c3324"/>' +
'<rect width="14" height="4.4" y="9.6" fill="#1c3324"/>' +
'<rect x="0" width="4.4" height="14" fill="#1c3324"/>' +
'<rect x="9.6" width="4.4" height="14" fill="#1c3324"/>' +
'<rect width="14" height="1.4" y="6.3" fill="#0a1120"/>' +
'<rect x="6.3" width="1.4" height="14" fill="#0a1120"/>' +
'<rect width="14" height=".7" y="2" fill="#5c0f16" opacity=".6"/>' +
'<rect width="14" height=".7" y="11.3" fill="#5c0f16" opacity=".6"/>' +
'</pattern>' +
'<filter id="mgLift" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2.4" stdDeviation="2.1" flood-color="#000" flood-opacity=".4"/></filter>' +
'</defs>';
}

/* Small rivets ringing the shield border, matching the real costume shield's
riveted-edge look. Computed rather than hand-typed so the spacing stays even. */
function macShieldRivets(cx, cy, r) {
var out = '';
var count = 10;
for (var i = 0; i < count; i++) {
var a = (Math.PI * 2 * i) / count;
var x = cx + Math.cos(a) * r;
var y = cy + Math.sin(a) * r;
out += '<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="1.3" fill="#9aa4ae" stroke="#5f6874" stroke-width=".4"></circle>';
}
return out;
}

function macRigMarkup() {
return '<svg class="mac-rig" viewBox="0 0 220 250" aria-hidden="true">' +
macDefsMarkup() +
'<g class="mac-rig__wrap">' +
'<ellipse class="mac-rig__shadow" cx="110" cy="236" rx="46" ry="8"></ellipse>' +
'<g class="mac-rig__leg-l" transform="translate(94,182)"><rect x="-9" y="0" width="18" height="34" rx="7" fill="url(#mgSockWhite)"></rect><ellipse cx="0" cy="38" rx="13" ry="8" fill="url(#mgShoe)"></ellipse><path d="M-9,35 L-2,41" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".85"></path><path d="M-5,33 L2,40" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".85"></path><path d="M-1,32 L6,39" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".85"></path></g>' +
'<g class="mac-rig__leg-r" transform="translate(126,182)"><rect x="-9" y="0" width="18" height="34" rx="7" fill="url(#mgSockWhite)"></rect><ellipse cx="0" cy="38" rx="13" ry="8" fill="url(#mgShoe)"></ellipse><path d="M-9,35 L-2,41" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".85"></path><path d="M-5,33 L2,40" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".85"></path><path d="M-1,32 L6,39" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".85"></path></g>' +
'<g class="mac-rig__body">' +
'<path d="M74,150 L146,150 L156,196 L64,196 Z" fill="url(#mgTartan)"></path>' +
'<path d="M78,151 L110,150 L104,196 L70,196 Z" fill="#fff" opacity=".06"></path>' +
'<path d="M76,96 Q72,86 82,80 L138,80 Q148,86 144,96 L150,152 Q110,166 70,152 Z" fill="url(#mgTorso)"></path>' +
'<path d="M82,80 L138,80 L134,92 L86,92 Z" fill="url(#mgTorsoDeep)"></path>' +
'<path d="M84,84 L92,148" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".07"></path>' +
'<g class="mac-rig__arm-l" transform="translate(72,96)" filter="url(#mgLift)"><g class="mac-rig__arm-l-rotor"><path d="M0,-4 Q-20,4 -22,34 Q-23,44 -14,48 Q-4,44 -6,32 Q-8,10 6,4 Z" fill="url(#mgTorso)"></path><circle cx="-15" cy="47" r="9.5" fill="url(#mgGlove)"></circle><ellipse cx="-18" cy="43" rx="2.6" ry="1.8" fill="#fff" opacity=".5"></ellipse></g></g>' +
'<g class="mac-rig__arm-r" transform="translate(148,96)" filter="url(#mgLift)"><g class="mac-rig__arm-r-rotor"><path d="M0,-4 Q20,4 22,34 Q23,44 14,48 Q4,44 6,32 Q8,10 -6,4 Z" fill="url(#mgTorso)"></path><circle cx="15" cy="47" r="9.5" fill="url(#mgGlove)"></circle><ellipse cx="12" cy="43" rx="2.6" ry="1.8" fill="#fff" opacity=".5"></ellipse></g></g>' +
'<rect x="72" y="145" width="76" height="7" rx="1.5" fill="#4a2f1a"></rect>' +
'<rect x="72" y="145" width="76" height="2" fill="#6b4726" opacity=".6"></rect>' +
'<rect x="103" y="143" width="14" height="11" rx="2" fill="none" stroke="#9aa3ac" stroke-width="2.4"></rect>' +
'<rect x="107" y="146.5" width="6" height="4" fill="none" stroke="#9aa3ac" stroke-width="1.6"></rect>' +
'<ellipse cx="110" cy="168" rx="12" ry="10" fill="#5a4a3a"></ellipse>' +
'<ellipse cx="110" cy="165" rx="12" ry="7" fill="#8a99a3"></ellipse>' +
'<circle cx="110" cy="165" r="3.2" fill="#c7d0d8"></circle>' +
'<rect x="106" y="174" width="3" height="13" rx="1.5" fill="#2a2118"></rect>' +
'<rect x="115" y="174" width="3" height="13" rx="1.5" fill="#2a2118"></rect>' +
'<circle cx="110" cy="118" r="17" fill="url(#mgShield)"></circle>' +
'<circle cx="110" cy="118" r="17" fill="none" stroke="#7c8895" stroke-width="1.6"></circle>' +
macShieldRivets(110, 118, 14.6) +
'<ellipse cx="104" cy="112" rx="5.5" ry="3.4" fill="#fff" opacity=".6"></ellipse>' +
'<circle class="mac-rig__shield-glow" cx="110" cy="118" r="20" fill="none" stroke="#ff6600" stroke-width="3"></circle>' +
'<text x="110" y="120" text-anchor="middle" font-family="Inter,ui-sans-serif,system-ui,sans-serif" font-weight="800" font-size="14" fill="#e05e00">M</text>' +
'<text x="110" y="128" text-anchor="middle" font-family="Inter,ui-sans-serif,system-ui,sans-serif" font-weight="700" font-size="4.4" letter-spacing=".2" fill="#1b2e4d">MCLENNAN</text>' +
'<g class="mac-rig__head" transform="translate(110,58)" filter="url(#mgLift)"><g class="mac-rig__head-rotor">' + macFaceMarkup() + '</g></g>' +
'</g>' +
'</g>' +
'</svg>';
}

/* The face parts alone, shared between the full-body rig and the small
static avatar in the panel header (drawn there with its own tight viewBox
instead of trying to crop the full body into a 46px box). */
function macFaceMarkup() {
return '<path d="M-30,-6 Q-30,-32 0,-34 Q30,-32 30,-6 Q30,2 24,4 L-24,4 Q-30,2 -30,-6 Z" fill="url(#mgTartan)"></path>' +
'<path d="M-27,-16 Q-22,-28 -4,-31" stroke="#000" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".2"></path>' +
'<rect x="-31" y="-2" width="62" height="7" rx="3" fill="#141c28"></rect>' +
'<rect x="-31" y="-2" width="62" height="2.4" rx="1.2" fill="#2c3b52" opacity=".6"></rect>' +
'<circle cx="0" cy="-32" r="4.2" fill="#141c28"></circle>' +
'<circle cx="-1.4" cy="-33.4" r="1.3" fill="#3a4b66" opacity=".8"></circle>' +
'<ellipse cx="0" cy="14" rx="24" ry="23" fill="url(#mgSkin)"></ellipse>' +
'<ellipse cx="-9" cy="1" rx="8.5" ry="6" fill="#fff" opacity=".2"></ellipse>' +
'<path d="M-19,18 Q-19,13 0,13 Q19,13 19,18 Q26,32 17,42 Q9,50 0,50 Q-9,50 -17,42 Q-26,32 -19,18 Z" fill="url(#mgBeard)"></path>' +
'<path d="M-18,17 Q-18,14 0,14 Q18,14 18,17 Q18,21 0,22 Q-18,21 -18,17 Z" fill="url(#mgBeardDeep)"></path>' +
'<g class="mac-rig__eyes">' +
'<ellipse cx="-9" cy="8.5" rx="5.4" ry="6.4" fill="#fff"></ellipse><ellipse cx="9" cy="8.5" rx="5.4" ry="6.4" fill="#fff"></ellipse>' +
'<ellipse cx="-9" cy="9" rx="4.3" ry="5.3" fill="#0a0a0a"></ellipse><ellipse cx="9" cy="9" rx="4.3" ry="5.3" fill="#0a0a0a"></ellipse>' +
'<circle cx="-7.6" cy="6.8" r="1.1" fill="#fff" opacity=".9"></circle><circle cx="10.4" cy="6.8" r="1.1" fill="#fff" opacity=".9"></circle>' +
'</g>' +
'<path d="M-13,2 Q-9,-1 -5,1" stroke="#8f350f" stroke-width="2" fill="none" stroke-linecap="round"></path>' +
'<path d="M5,1 Q9,-1 13,2" stroke="#8f350f" stroke-width="2" fill="none" stroke-linecap="round"></path>' +
'<path d="M-5,13 Q0,16 5,13" stroke="#4a1c08" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"></path>';
}

function macAvatarMarkup() {
return '<svg viewBox="-33 -36 66 88" aria-hidden="true">' + macDefsMarkup() + '<g class="mac-rig__head-rotor">' + macFaceMarkup() + '</g></svg>';
}

var guide = document.createElement('aside');
guide.className = 'mac-guide';
guide.setAttribute('aria-label', 'Mac, MCC AI Guide');
guide.innerHTML = [
'<button class="mac-guide__launcher" type="button" aria-label="Ask Mac, the draggable MCC site navigator" aria-expanded="false">',
'<span class="mac-guide__label"><span class="mac-guide__label-text"><strong>Ask Mac</strong><small>Drag me · click for help</small></span></span>',
'<span class="mac-guide__character">' + macRigMarkup() + '</span>',
'</button>',
'<div class="mac-guide__hello" hidden><strong>Hi, I’m Mac!</strong><span>Your MCC AI guide — click me anytime.</span></div>',
'<div class="mac-guide__nudge" hidden>',
'<button class="mac-guide__nudge-close" type="button" aria-label="Dismiss suggestion">×</button>',
'<p class="mac-guide__nudge-text" data-mac-nudge-text></p>',
'<a class="mac-guide__nudge-link" data-mac-nudge-link href="#"></a>',
'</div>',
'<section class="mac-guide__panel" role="dialog" aria-modal="false" aria-labelledby="mac-guide-title">',
'<header class="mac-guide__head">',
'<span class="mac-guide__avatar">' + macAvatarMarkup() + '</span>',
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
var labelText = guide.querySelector('.mac-guide__label-text');
var hello = guide.querySelector('.mac-guide__hello');
var nudge = guide.querySelector('.mac-guide__nudge');
var nudgeText = guide.querySelector('[data-mac-nudge-text]');
var nudgeLink = guide.querySelector('[data-mac-nudge-link]');
var nudgeClose = guide.querySelector('.mac-guide__nudge-close');
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
var hoverTimer = null;
var hoverReturnTimer = null;
var closeTimer = null;
var celebrateTimer = null;
var celebrateHoldTimer = null;
var labelTextHTML = labelText ? labelText.innerHTML : '';
var wanderCleanupTimer = null;
var nudgeAutoHideTimer = null;
var helloHideTimer = null;
var introTimer = null;
var hasOpenedThisSession = false;
var hasIntroducedSelf = false;
try { hasIntroducedSelf = !!window.localStorage.getItem(introClickKey); } catch (error) {}
var idleMomentCount = 0;
var currentPose = 'idle';
var isHovering = false;
var drag = null;
var suppressClick = false;

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

/* Poses are now just a data attribute the CSS reacts to — swapping between
them eases the affected limb's own rotation/position, so "changing pose"
is continuous motion instead of a cut between two different pictures. */
function setPose(name) {
if (currentPose === name) return;
currentPose = name;
if (name === 'idle') character.removeAttribute('data-pose');
else character.setAttribute('data-pose', name);
}

function stopIdle() {
idleTimer = clearTimer(idleTimer);
poseHoldTimer = clearTimer(poseHoldTimer);
}

function nextIdleDelay() {
idleMomentCount += 1;
if (idleMomentCount % 3 === 0 || Math.random() < 0.18) {
return randomBetween(45000, 90000);
}
return randomBetween(18000, 45000);
}

/* A brief "hand to chin" gesture — the closest thing to the old discrete
"thinking" pose, but now a real limb movement layered on the constant
idle breathing/blinking rather than a separate picture. */
function ponder() {
setPose('think');
poseHoldTimer = window.setTimeout(function () {
poseHoldTimer = null;
if (!isHovering && !drag && !guide.classList.contains('is-open')) setPose('idle');
startIdle();
}, randomBetween(2200, 3200));
}

function startIdle(delay) {
stopIdle();
if (reducedMotion || guide.classList.contains('is-open') || document.hidden) return;
idleTimer = window.setTimeout(function () {
idleTimer = null;
if (isHovering || drag || document.hidden || guide.classList.contains('is-open') || guide.hidden) {
startIdle(randomBetween(12000, 24000));
return;
}
var roll = Math.random();
if (window.innerWidth > 600 && roll < 0.16) {
wander();
return;
}
if (roll < 0.38) {
ponder();
return;
}
startIdle();
}, delay === undefined ? nextIdleDelay() : delay);
}

/* Independent of the pose-idle loop above on purpose: a suggestion carries
real information, so — unlike the breathing loop and wandering, which are
pure motion flourishes — it still runs for anyone with reduced motion set,
just without the slide/fade transition (handled in CSS). */
function scheduleNudge() {
if (hasOpenedThisSession) return;
try {
if (window.sessionStorage.getItem(nudgeShownKey)) return;
} catch (error) {}
window.setTimeout(function () {
if (hasOpenedThisSession) return;
if (document.hidden || guide.classList.contains('is-open') || guide.hidden || isHovering || drag) {
scheduleNudge();
return;
}
attemptNudge();
}, randomBetween(24000, 42000));
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

function moveTo(left, top, animated) {
var width = launcher.offsetWidth;
var height = launcher.offsetHeight;
var safeLeft = clamp(left, 8, Math.max(8, window.innerWidth - width - 8));
var safeTop = clamp(top, 8, Math.max(8, window.innerHeight - height - 8));
guide.classList.add('is-positioned');
if (animated && !reducedMotion) {
guide.classList.add('is-wandering');
wanderCleanupTimer = clearTimer(wanderCleanupTimer);
wanderCleanupTimer = window.setTimeout(function () {
wanderCleanupTimer = null;
guide.classList.remove('is-wandering');
}, 950);
} else {
guide.classList.remove('is-wandering');
}
guide.style.left = safeLeft + 'px';
guide.style.top = safeTop + 'px';
guide.style.right = 'auto';
guide.style.bottom = 'auto';
if (guide.classList.contains('is-open')) positionPanel();
}

/* A rare, self-initiated stroll instead of only swapping pose in place. He
sticks to a "home" corner most of the time and occasionally visits the
other three, always landing near an edge rather than drifting over page
content, with a soft glide driven by the .is-wandering transition and a
real walk cycle (leg swing + arm swing + step bob) on the rig itself. */
function pickWanderSpot() {
var margin = 24;
var width = launcher.offsetWidth;
var height = launcher.offsetHeight;
var zones = [
{ x: window.innerWidth - width - margin, y: window.innerHeight - height - margin, weight: 45 },
{ x: margin, y: window.innerHeight - height - margin, weight: 25 },
{ x: window.innerWidth - width - margin, y: margin + 60, weight: 15 },
{ x: margin, y: margin + 60, weight: 15 }
];
var total = zones.reduce(function (sum, zone) { return sum + zone.weight; }, 0);
var draw = Math.random() * total;
var chosen = zones[zones.length - 1];
zones.some(function (zone) {
draw -= zone.weight;
if (draw > 0) return false;
chosen = zone;
return true;
});
return {
left: chosen.x + randomBetween(-40, 40),
top: chosen.y + randomBetween(-30, 30)
};
}

function wander() {
var spot = pickWanderSpot();
setPose('wander');
moveTo(spot.left, spot.top, true);
savePosition();
poseHoldTimer = window.setTimeout(function () {
poseHoldTimer = null;
if (!isHovering && !drag && !guide.classList.contains('is-open')) setPose('idle');
startIdle();
}, randomBetween(3000, 6000));
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
hasOpenedThisSession = true;
hideNudge();
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
setPose('idle');
startIdle(randomBetween(18000, 36000));
}
}, reducedMotion ? 0 : randomBetween(500, 850));
launcher.focus();
}

/* Reacts to real events instead of only idle randomness — currently the
'mcc:activity-complete' signal that activity pages already dispatch when a
learner finishes something (Find Your Ten Hours' plan, The Safe
Hypothetical's copy button, and so on). Mac hops with both arms up and, if
his panel is closed, briefly expands his floating label to a short
acknowledgement so the reaction is visible without anyone opening him. */
function celebrate() {
if (guide.hidden) return;
celebrateTimer = clearTimer(celebrateTimer);
celebrateHoldTimer = clearTimer(celebrateHoldTimer);
stopIdle();
setPose('celebrate');
guide.classList.add('is-celebrating');
if (guide.classList.contains('is-open')) {
statusLabel.textContent = 'Nice — that’s progress logged';
celebrateHoldTimer = window.setTimeout(function () {
celebrateHoldTimer = null;
if (guide.classList.contains('is-open')) statusLabel.textContent = 'Ready to help';
}, 4200);
} else if (labelText) {
labelText.innerHTML = 'Nice work!<small>That’s progress logged</small>';
celebrateHoldTimer = window.setTimeout(function () {
celebrateHoldTimer = null;
labelText.innerHTML = labelTextHTML;
}, 4200);
}
celebrateTimer = window.setTimeout(function () {
celebrateTimer = null;
guide.classList.remove('is-celebrating');
if (!isHovering && !drag && !guide.classList.contains('is-open')) {
setPose('idle');
startIdle(randomBetween(18000, 36000));
}
}, 4600);
}

/* An occasional, unprompted suggestion — capped hard to once per browser
session, only while genuinely idle, and only before the learner has opened
Mac themselves (once they have, he assumes they know how to ask). Content
comes from the same catalog relationships already used elsewhere: the
current activity's first related item, or a sensible starting point when
there is no current activity. */
function pickNudgeSuggestion() {
var here = activityHere();
if (here && here.related && here.related.length) {
var next = itemById(here.related[0]);
if (next) return { text: 'Haven’t tried ' + next.title + ' yet — it builds well on this one.', item: next };
}
if (!here) {
var starter = itemById('llm-works');
if (starter) return { text: 'New here? How an LLM Works is a good place to start.', item: starter };
}
return null;
}

function hideNudge() {
if (!nudge) return;
nudgeAutoHideTimer = clearTimer(nudgeAutoHideTimer);
nudge.classList.remove('is-visible');
window.setTimeout(function () {
if (!nudge.classList.contains('is-visible')) nudge.hidden = true;
}, 260);
}

function showNudge(suggestion) {
if (!nudge || !nudgeText || !nudgeLink) return;
nudgeText.textContent = suggestion.text;
nudgeLink.textContent = (suggestion.item.cta || 'Take a look') + ' →';
nudgeLink.href = new URL(suggestion.item.path, siteRoot).href;
/* Anchor off whichever edges Mac is actually near right now — he may have
wandered anywhere, not just his default bottom-right home. */
var rect = guide.getBoundingClientRect();
nudge.classList.toggle('mac-guide__nudge--below', rect.top < window.innerHeight / 2);
nudge.classList.toggle('mac-guide__nudge--left', rect.left < window.innerWidth / 2);
nudge.hidden = false;
window.requestAnimationFrame(function () {
nudge.classList.add('is-visible');
});
nudgeAutoHideTimer = clearTimer(nudgeAutoHideTimer);
nudgeAutoHideTimer = window.setTimeout(hideNudge, 12000);
}

function attemptNudge() {
if (hasOpenedThisSession || guide.hidden) return false;
try {
if (window.sessionStorage.getItem(nudgeShownKey)) return false;
} catch (error) {}
var suggestion = pickNudgeSuggestion();
if (!suggestion) return false;
try { window.sessionStorage.setItem(nudgeShownKey, '1'); } catch (error) {}
showNudge(suggestion);
return true;
}

if (nudgeClose) {
nudgeClose.addEventListener('click', function (event) {
event.stopPropagation();
hideNudge();
});
}

/* A one-time-ever self-introduction on the very first click, before the
panel opens — after that he assumes you already know who he is. */
function showHello(onDone) {
if (!hello) { onDone(); return; }
hideNudge();
setPose('wave');
hello.hidden = false;
window.requestAnimationFrame(function () {
hello.classList.add('is-visible');
});
helloHideTimer = clearTimer(helloHideTimer);
helloHideTimer = window.setTimeout(function () {
hello.classList.remove('is-visible');
window.setTimeout(function () { hello.hidden = true; }, 250);
onDone();
}, reducedMotion ? 500 : 1500);
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
if (!drag.moved) setPose('drag');
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
setPose('idle');
startIdle(randomBetween(18000, 36000));
}
}

launcher.addEventListener('pointerup', finishDrag);
launcher.addEventListener('pointercancel', finishDrag);
launcher.addEventListener('dragstart', function (event) { event.preventDefault(); });

launcher.addEventListener('click', function () {
if (suppressClick) return;
if (guide.classList.contains('is-open')) {
shutGuide();
return;
}
if (!hasIntroducedSelf) {
hasIntroducedSelf = true;
try { window.localStorage.setItem(introClickKey, '1'); } catch (error) {}
showHello(openGuide);
return;
}
openGuide();
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
setPose('idle');
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
setPose('idle');
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
scheduleNudge();
/* The label starts as a small badge (see CSS) and briefly expands on every
page load so it stays discoverable without sitting there permanently. */
if (!reducedMotion) {
guide.classList.add('is-intro');
introTimer = window.setTimeout(function () {
introTimer = null;
guide.classList.remove('is-intro');
}, 4200);
}
/* Once per calendar day rather than once per browser session — he greets
you again tomorrow instead of only the first time a tab is opened, which
is what actually gives him a daily rhythm instead of a session reset. */
var shouldWave = false;
try {
var todayKey = new Date().toDateString();
shouldWave = window.localStorage.getItem(greetingKey) !== todayKey;
window.localStorage.setItem(greetingKey, todayKey);
} catch (error) {
shouldWave = true;
}
if (reducedMotion || !shouldWave) {
setPose('idle');
startIdle();
return;
}
setPose('wave');
window.setTimeout(function () {
if (!guide.classList.contains('is-open') && !isHovering) setPose('idle');
startIdle();
}, randomBetween(1800, 2400));
}

initial();
})();
