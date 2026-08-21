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

  var guide = document.createElement('aside');
  guide.className = 'mac-guide';
  guide.setAttribute('aria-label', 'Mac, MCC site navigator');
  guide.innerHTML = [
    '<button class="mac-guide__launcher" type="button" aria-label="Ask Mac, the draggable MCC site navigator" aria-expanded="false">',
      '<span class="mac-guide__label">Ask Mac<small>Drag me · click for help</small></span>',
      '<img class="mac-guide__character" src="' + poseUrls.wave + '" alt="" draggable="false">',
    '</button>',
    '<section class="mac-guide__panel" role="dialog" aria-modal="false" aria-labelledby="mac-guide-title">',
      '<header class="mac-guide__head">',
        '<img class="mac-guide__avatar" src="' + poseUrls.wave + '" alt="">',
        '<div class="mac-guide__title"><strong id="mac-guide-title">Mac · MCC Navigator</strong><span>Working on it</span></div>',
        '<button class="mac-guide__close" type="button" aria-label="Close Mac navigator">×</button>',
      '</header>',
      '<div class="mac-guide__body">',
        '<div class="mac-guide__location">You are here: <strong data-mac-location>MCC AI Professional Development</strong></div>',
        '<p class="mac-guide__intro">Tell me what you want to learn or accomplish. I’ll point you toward the most useful MCC activity.</p>',
        '<div class="mac-guide__quick" aria-label="Quick navigation questions">',
          '<button class="mac-guide__chip" type="button" data-query="I am new to AI">New to AI</button>',
          '<button class="mac-guide__chip" type="button" data-query="faculty teaching">Faculty resources</button>',
          '<button class="mac-guide__chip" type="button" data-query="verification accuracy">Check an answer</button>',
          '<button class="mac-guide__chip" type="button" data-query="15 minute beginner">Under 15 minutes</button>',
          '<button class="mac-guide__chip" type="button" data-query="build a tool">Build something</button>',
        '</div>',
        '<div class="mac-guide__results" aria-live="polite" data-mac-results></div>',
      '</div>',
      '<form class="mac-guide__form">',
        '<label class="sr-only" for="mac-guide-input">Ask Mac what you want to find</label>',
        '<input class="mac-guide__input" id="mac-guide-input" type="search" placeholder="What would you like to find?" autocomplete="off">',
        '<button class="mac-guide__send" type="submit">Find</button>',
      '</form>',
      '<div class="mac-guide__note">Mac searches the MCC site catalog in this browser. Your question is not sent to an outside AI service.</div>',
    '</section>'
  ].join('');
  document.body.appendChild(guide);

  var launcher = guide.querySelector('.mac-guide__launcher');
  var character = guide.querySelector('.mac-guide__character');
  var panel = guide.querySelector('.mac-guide__panel');
  var close = guide.querySelector('.mac-guide__close');
  var input = guide.querySelector('.mac-guide__input');
  var form = guide.querySelector('.mac-guide__form');
  var results = guide.querySelector('[data-mac-results]');
  var locationLabel = guide.querySelector('[data-mac-location]');
  var statusLabel = guide.querySelector('.mac-guide__title span');
  var catalog = window.MCC_CONTENT || [];
  var idleTimer = null;
  var poseHoldTimer = null;
  var poseSwapTimer = null;
  var hoverTimer = null;
  var hoverReturnTimer = null;
  var closeTimer = null;
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
    }
    if (tokens.indexOf('15') > -1 && /^(8|10|12|15)/.test(item.duration)) total += 4;
    return total;
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
  guide.querySelectorAll('[data-query]').forEach(function (button) {
    button.addEventListener('click', function () {
      input.value = button.dataset.query;
      find(input.value);
    });
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    find(input.value);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && guide.classList.contains('is-open')) shutGuide();
  });
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
    if (!catalog.length) window.setTimeout(refreshContext, 120);
    results.innerHTML = '<div class="mac-guide__empty">Choose a quick question, or describe what you need help finding.</div>';
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
