/* ============================================================================
   mcc-scenario.js — the scenario engine
   ----------------------------------------------------------------------------
   Ted Gonzalez, JD/MBA · MCC AI Professional Development
   © 2026. All rights reserved.

   Runs interactive missions defined entirely in JSON. Adding a new scenario
   never requires touching this file — see scenarios/data/README for the format.

   Step types: brief · choice · multi · sort · inspect · terminal · reveal
   Artifacts:  doc · email · chat · table · terminal
   ========================================================================== */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------- helpers */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Very small inline formatter: **bold**, *italic*, `code`, and line breaks.
     Everything is escaped first, so scenario JSON can never inject markup. */
  function fmt(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  function para(s) { return s ? '<p>' + fmt(s) + '</p>' : ''; }

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function shuffleStable(arr, seed) {
    /* Deterministic shuffle so a projected screen and a learner's phone agree. */
    var a = arr.slice(), s = seed || 1;
    for (var i = a.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      var j = s % (i + 1);
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* ----------------------------------------------------------- artifacts */

  function renderArtifact(a) {
    if (!a) return '';
    var k = a.kind;

    if (k === 'email') {
      return '<div class="art art-email">' +
        '<div class="art-head">' + esc(a.label || 'Email') + '</div>' +
        '<div class="art-meta">' +
          (a.from ? '<div><span>From</span>' + esc(a.from) + '</div>' : '') +
          (a.to ? '<div><span>To</span>' + esc(a.to) + '</div>' : '') +
          (a.date ? '<div><span>Date</span>' + esc(a.date) + '</div>' : '') +
          (a.subject ? '<div><span>Subject</span>' + esc(a.subject) + '</div>' : '') +
        '</div>' +
        '<div class="art-body">' + para(a.body) + '</div></div>';
    }

    if (k === 'doc') {
      var lines = (a.lines || []).map(function (ln) {
        if (typeof ln === 'string') return '<p>' + fmt(ln) + '</p>';
        if (ln.redacted) {
          return '<p class="redline">' +
            '<span class="redbox" data-reveal="' + esc(ln.under || '') + '" ' +
            'title="A black box drawn over the text">' +
            '<span class="redtext">' + esc(ln.under || '') + '</span></span>' +
            (ln.after ? ' ' + fmt(ln.after) : '') + '</p>';
        }
        if (ln.heading) return '<h4>' + fmt(ln.heading) + '</h4>';
        return '<p>' + fmt(ln.text || '') + '</p>';
      }).join('');
      return '<div class="art art-doc">' +
        '<div class="art-head">' + esc(a.label || 'Document') + '</div>' +
        '<div class="art-body doc">' + lines + '</div></div>';
    }

    if (k === 'chat') {
      var turns = (a.turns || []).map(function (t) {
        return '<div class="turn ' + (t.who === 'ai' ? 'ai' : 'you') + '">' +
          '<div class="who">' + esc(t.who === 'ai' ? (a.aiName || 'Assistant') : 'You') + '</div>' +
          '<div class="msg">' + para(t.text) + '</div></div>';
      }).join('');
      return '<div class="art art-chat">' +
        '<div class="art-head">' + esc(a.label || 'Assistant') + '</div>' +
        '<div class="art-body">' + turns + '</div></div>';
    }

    if (k === 'table') {
      var head = '<tr>' + (a.columns || []).map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
      var rows = (a.rows || []).map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('');
      return '<div class="art art-table">' +
        '<div class="art-head">' + esc(a.label || 'Data') + '</div>' +
        '<div class="art-body"><table><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    if (k === 'terminal') {
      return '<div class="art art-term"><div class="art-head">' + esc(a.label || 'Terminal') + '</div>' +
        '<pre class="art-body">' + (a.lines || []).map(esc).join('\n') + '</pre></div>';
    }

    return '';
  }

  /* ------------------------------------------------------------- engine */

  function Runner(mount, scenario, opts) {
    this.mount = mount;
    this.s = scenario;
    this.opts = opts || {};
    this.i = 0;
    this.answers = {};
    this.score = { asked: 0, right: 0 };
    this.storeKey = 'mcc-scenario-' + scenario.id;
  }

  Runner.prototype.saveProgress = function (done) {
    try {
      var all = JSON.parse(localStorage.getItem('mcc-scenarios') || '{}');
      var prev = all[this.s.id];
      all[this.s.id] = {
        step: this.i,
        total: this.s.steps.length,
        asked: this.score.asked,
        right: this.score.right,
        /* Once finished, stay finished — jumping back to review a step
           should not wipe the completion badge. */
        done: !!done || !!(prev && prev.done),
        when: new Date().toISOString()
      };
      localStorage.setItem('mcc-scenarios', JSON.stringify(all));
    } catch (e) { /* private browsing — progress just will not persist */ }
    if (this.opts.onProgress) this.opts.onProgress(this.s.id, this.i, this.s.steps.length, !!done);
  };

  Runner.prototype.go = function (n) {
    this.i = Math.max(0, Math.min(n, this.s.steps.length));
    this.render();
    this.saveProgress(this.i >= this.s.steps.length);
    if (this.opts.onStep) this.opts.onStep(this.s.id, this.i);
  };

  Runner.prototype.next = function () { this.go(this.i + 1); };
  Runner.prototype.prev = function () { this.go(this.i - 1); };

  Runner.prototype.render = function () {
    var self = this;
    var total = this.s.steps.length;

    if (this.i >= total) { this.renderSummary(); return; }

    var step = this.s.steps[this.i];
    var pct = Math.round((this.i / total) * 100);

    var html =
      '<div class="run">' +
        '<div class="runbar">' +
          '<button class="rb back" type="button" data-nav="back">&larr; ' +
            (this.i === 0 ? 'All scenarios' : 'Back') + '</button>' +
          '<div class="rprog"><div class="rprogfill" style="width:' + pct + '%"></div></div>' +
          '<div class="rcount">Step ' + (this.i + 1) + ' of ' + total + '</div>' +
        '</div>' +
        '<div class="runbody">' +
          (step.title ? '<h2 class="stitle">' + fmt(step.title) + '</h2>' : '') +
          (step.body ? '<div class="sbody">' + para(step.body) + '</div>' : '') +
          renderArtifact(step.artifact) +
          '<div class="sinter" id="sinter"></div>' +
        '</div>' +
      '</div>';

    this.mount.innerHTML = html;
    var inter = this.mount.querySelector('#sinter');

    this.mount.querySelector('[data-nav="back"]').addEventListener('click', function () {
      if (self.i === 0) { if (self.opts.onExit) self.opts.onExit(); }
      else self.prev();
    });

    var fn = this['step_' + step.type];
    if (!fn) {
      inter.innerHTML = '<p class="warn">Unknown step type "' + esc(step.type) + '".</p>' + this.contBtn();
      this.wireCont(inter);
    } else {
      fn.call(this, inter, step);
    }

    this.mount.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  Runner.prototype.contBtn = function (label) {
    return '<div class="acts"><button class="primary" type="button" data-cont>' +
      esc(label || 'Continue') + '</button></div>';
  };

  Runner.prototype.wireCont = function (scope) {
    var self = this;
    var b = scope.querySelector('[data-cont]');
    if (b) b.addEventListener('click', function () { self.next(); });
  };

  /* ---- brief ---- */
  Runner.prototype.step_brief = function (inter, step) {
    inter.innerHTML = this.contBtn(step.cta);
    this.wireCont(inter);
  };

  /* ---- choice (single answer) ---- */
  Runner.prototype.step_choice = function (inter, step) {
    var self = this;
    var opts = step.shuffle === false ? step.options : shuffleStable(step.options, step.options.length * 7 + this.i);
    inter.innerHTML =
      (step.prompt ? '<div class="prompt">' + fmt(step.prompt) + '</div>' : '') +
      '<div class="opts" role="radiogroup">' +
      opts.map(function (o, n) {
        return '<button class="opt" type="button" role="radio" aria-checked="false" data-n="' + n + '">' +
          '<span class="dot"></span><span class="otext">' + fmt(o.text) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="fb" hidden></div>' +
      '<div class="acts"><button class="primary" type="button" data-cont hidden>Continue</button></div>';

    var fbEl = inter.querySelector('.fb');
    var contEl = inter.querySelector('[data-cont]');
    var answered = false;

    inter.querySelectorAll('.opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (answered) return;
        answered = true;
        var o = opts[+btn.dataset.n];

        inter.querySelectorAll('.opt').forEach(function (b2, k) {
          b2.disabled = true;
          if (opts[k].correct) b2.classList.add('right');
        });
        btn.classList.add(o.correct ? 'chosen-right' : 'chosen-wrong');
        btn.setAttribute('aria-checked', 'true');

        self.score.asked++;
        if (o.correct) self.score.right++;
        self.answers[self.i] = { correct: !!o.correct, text: o.text };

        fbEl.hidden = false;
        fbEl.className = 'fb ' + (o.correct ? 'good' : 'bad');
        fbEl.innerHTML = '<div class="fbhead">' + (o.correct ? 'That is the call.' : 'Not quite.') + '</div>' +
          para(o.feedback || (o.correct ? '' : step.wrongNote || ''));
        contEl.hidden = false;
        contEl.focus();
      });
    });

    this.wireCont(inter);
  };

  /* ---- multi (select all that apply) ---- */
  Runner.prototype.step_multi = function (inter, step) {
    var self = this;
    var opts = step.options;
    inter.innerHTML =
      (step.prompt ? '<div class="prompt">' + fmt(step.prompt) + '</div>' : '') +
      '<div class="opts">' +
      opts.map(function (o, n) {
        return '<button class="opt check" type="button" role="checkbox" aria-checked="false" data-n="' + n + '">' +
          '<span class="box"></span><span class="otext">' + fmt(o.text) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="acts"><button class="primary" type="button" data-check>Check my answer</button></div>' +
      '<div class="fb" hidden></div>';

    var picked = {};
    inter.querySelectorAll('.opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var n = +btn.dataset.n;
        picked[n] = !picked[n];
        btn.classList.toggle('on', picked[n]);
        btn.setAttribute('aria-checked', picked[n] ? 'true' : 'false');
      });
    });

    inter.querySelector('[data-check]').addEventListener('click', function () {
      var allRight = true, missed = [], wrong = [];
      inter.querySelectorAll('.opt').forEach(function (btn, n) {
        btn.disabled = true;
        var should = !!opts[n].correct, did = !!picked[n];
        if (should) btn.classList.add('right');
        if (should && !did) { allRight = false; missed.push(opts[n].text); }
        if (!should && did) { allRight = false; wrong.push(opts[n].text); btn.classList.add('chosen-wrong'); }
      });

      self.score.asked++;
      if (allRight) self.score.right++;
      self.answers[self.i] = { correct: allRight };

      var fbEl = inter.querySelector('.fb');
      fbEl.hidden = false;
      fbEl.className = 'fb ' + (allRight ? 'good' : 'bad');
      var msg = '<div class="fbhead">' + (allRight ? 'All of them, and nothing extra.' : 'Close — look again.') + '</div>';
      if (missed.length) msg += '<p><strong>Missed:</strong> ' + missed.map(esc).join('; ') + '</p>';
      if (wrong.length) msg += '<p><strong>Should not have been selected:</strong> ' + wrong.map(esc).join('; ') + '</p>';
      msg += para(step.explain);
      fbEl.innerHTML = msg;

      this.hidden = true;
      var cont = el('<div class="acts"><button class="primary" type="button" data-cont>Continue</button></div>');
      inter.appendChild(cont);
      self.wireCont(inter);
      cont.querySelector('button').focus();
    });
  };

  /* ---- sort into buckets ---- */
  Runner.prototype.step_sort = function (inter, step) {
    var self = this;
    var items = shuffleStable(step.items, step.items.length * 13 + this.i);
    var buckets = step.buckets;

    inter.innerHTML =
      (step.prompt ? '<div class="prompt">' + fmt(step.prompt) + '</div>' : '') +
      '<div class="sortlist">' +
      items.map(function (it, n) {
        return '<div class="sortitem" data-n="' + n + '">' +
          '<div class="sittext">' + fmt(it.text) + '</div>' +
          '<div class="sitbtns" role="group" aria-label="Classify: ' + esc(it.text) + '">' +
          buckets.map(function (b) {
            return '<button type="button" class="bkt" data-b="' + esc(b.id) + '" ' +
              'style="--bc:' + esc(b.color || '#5C6E82') + '">' + esc(b.short || b.name) + '</button>';
          }).join('') + '</div>' +
          '<div class="sitwhy" hidden></div></div>';
      }).join('') + '</div>' +
      '<div class="acts"><button class="primary" type="button" data-check disabled>Check answers</button>' +
      '<span class="hint" id="sorthint">Classify all ' + items.length + ' to continue</span></div>' +
      '<div class="fb" hidden></div>';

    var chosen = {};
    function updateReady() {
      var done = Object.keys(chosen).length === items.length;
      inter.querySelector('[data-check]').disabled = !done;
      inter.querySelector('#sorthint').textContent = done
        ? 'Ready'
        : (items.length - Object.keys(chosen).length) + ' left to classify';
    }

    inter.querySelectorAll('.sortitem').forEach(function (row) {
      row.querySelectorAll('.bkt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.disabled) return;
          var n = +row.dataset.n;
          chosen[n] = btn.dataset.b;
          row.querySelectorAll('.bkt').forEach(function (b2) { b2.classList.toggle('on', b2 === btn); });
          updateReady();
        });
      });
    });

    inter.querySelector('[data-check]').addEventListener('click', function () {
      var right = 0;
      inter.querySelectorAll('.sortitem').forEach(function (row) {
        var n = +row.dataset.n, it = items[n];
        var ok = chosen[n] === it.bucket;
        if (ok) right++;
        row.classList.add(ok ? 'ok' : 'no');
        row.querySelectorAll('.bkt').forEach(function (b2) {
          b2.disabled = true;
          if (b2.dataset.b === it.bucket) b2.classList.add('answer');
        });
        var why = row.querySelector('.sitwhy');
        why.hidden = false;
        var bucketName = (buckets.filter(function (b) { return b.id === it.bucket; })[0] || {}).name || it.bucket;
        why.innerHTML = '<strong>' + esc(bucketName) + '</strong> — ' + fmt(it.why || '');
      });

      self.score.asked++;
      if (right === items.length) self.score.right++;
      self.answers[self.i] = { correct: right === items.length, detail: right + '/' + items.length };

      var fbEl = inter.querySelector('.fb');
      fbEl.hidden = false;
      fbEl.className = 'fb ' + (right === items.length ? 'good' : 'bad');
      fbEl.innerHTML = '<div class="fbhead">' + right + ' of ' + items.length + ' placed correctly.</div>' +
        para(step.explain);

      this.parentNode.innerHTML = '<button class="primary" type="button" data-cont>Continue</button>';
      self.wireCont(inter);
    });
  };

  /* ---- inspect: find the problems inside an artifact ---- */
  Runner.prototype.step_inspect = function (inter, step) {
    var self = this;
    var spans = step.spans || [];
    var targets = spans.filter(function (s) { return s.target; });

    /* Body text uses {{id|visible text}} to mark clickable regions. */
    function markup(text) {
      return fmt(text).replace(/\{\{([a-z0-9_-]+)\|([^}]*)\}\}/gi, function (_, id, label) {
        return '<button type="button" class="spot" data-id="' + esc(id) + '">' + label + '</button>';
      });
    }

    inter.innerHTML =
      (step.prompt ? '<div class="prompt">' + fmt(step.prompt) + '</div>' : '') +
      '<div class="inspectdoc">' + markup(step.text || '') + '</div>' +
      '<div class="found"><span class="fcount">0</span> of ' + targets.length + ' found</div>' +
      '<div class="fblist"></div>' +
      '<div class="acts"><button class="ghost" type="button" data-give>Show me the rest</button>' +
      '<button class="primary" type="button" data-cont hidden>Continue</button></div>';

    var got = {}, wrongClicks = 0;
    var countEl = inter.querySelector('.fcount');
    var listEl = inter.querySelector('.fblist');
    var contEl = inter.querySelector('[data-cont]');
    var giveEl = inter.querySelector('[data-give]');

    function reveal(id, viaGiveUp) {
      var sp = spans.filter(function (s) { return s.id === id; })[0];
      if (!sp || got[id]) return;
      got[id] = true;
      inter.querySelectorAll('.spot[data-id="' + id + '"]').forEach(function (b) {
        b.classList.add('hit'); b.disabled = true;
      });
      listEl.appendChild(el('<div class="fitem' + (viaGiveUp ? ' missed' : '') + '">' +
        '<strong>' + esc(sp.label || 'Problem') + '</strong>' + para(sp.note) + '</div>'));
      countEl.textContent = String(Object.keys(got).filter(function (k) {
        return spans.filter(function (s) { return s.id === k && s.target; }).length;
      }).length);
      finishIfDone();
    }

    function finishIfDone() {
      var foundTargets = targets.filter(function (t) { return got[t.id]; }).length;
      if (foundTargets === targets.length) {
        contEl.hidden = false;
        giveEl.hidden = true;
        if (!self.answers[self.i]) {
          self.score.asked++;
          if (!wrongClicks) self.score.right++;
          self.answers[self.i] = { correct: !wrongClicks, detail: foundTargets + '/' + targets.length };
        }
      }
    }

    inter.querySelectorAll('.spot').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.id;
        var sp = spans.filter(function (s) { return s.id === id; })[0];
        if (sp && sp.target) { reveal(id); }
        else {
          wrongClicks++;
          b.classList.add('miss');
          b.disabled = true;
          listEl.appendChild(el('<div class="fitem neutral"><strong>' +
            esc((sp && sp.label) || 'Not this one') + '</strong>' +
            para((sp && sp.note) || 'Nothing wrong here — keep looking.') + '</div>'));
        }
      });
    });

    giveEl.addEventListener('click', function () {
      if (!self.answers[self.i]) {
        self.score.asked++;
        self.answers[self.i] = { correct: false, detail: 'revealed' };
      }
      targets.forEach(function (t) { reveal(t.id, true); });
      contEl.hidden = false;
      giveEl.hidden = true;
    });

    this.wireCont(inter);
  };

  /* ---- omission: what did the summary leave out? ----
     Like inspect, but the learner hunts the SOURCE for material that never
     made it into the summary shown above it. Findings are ranked by how much
     the omission changes the meaning, because that ranking is the lesson. */
  Runner.prototype.step_omission = function (inter, step) {
    var self = this;
    var spans = step.spans || [];
    var targets = spans.filter(function (s) { return s.target; });

    var SEV = {
      trivial:      { label: 'Trivial',                 rank: 3, cls: 'sev-low' },
      consequential:{ label: 'Consequential',           rank: 2, cls: 'sev-mid' },
      reversing:    { label: 'Reverses the meaning',    rank: 1, cls: 'sev-high' }
    };

    function markup(text) {
      return fmt(text).replace(/\{\{([a-z0-9_-]+)\|([^}]*)\}\}/gi, function (_, id, label) {
        return '<button type="button" class="spot" data-id="' + esc(id) + '">' + label + '</button>';
      });
    }

    inter.innerHTML =
      '<div class="sumwrap"><div class="sumhead">' +
        esc(step.summaryLabel || 'The summary you were handed') + '</div>' +
        '<div class="sumbody">' + para(step.summary) + '</div></div>' +
      (step.prompt ? '<div class="prompt">' + fmt(step.prompt) + '</div>' : '') +
      '<div class="srchead">' + esc(step.sourceLabel || 'The document it was made from') + '</div>' +
      '<div class="inspectdoc">' + markup(step.text || '') + '</div>' +
      '<div class="found"><span class="fcount">0</span> of ' + targets.length + ' found</div>' +
      '<div class="fblist"></div>' +
      '<div class="acts"><button class="ghost" type="button" data-give>Show me what was dropped</button>' +
      '<button class="primary" type="button" data-cont hidden>Continue</button></div>';

    var got = {}, wrongClicks = 0;
    var countEl = inter.querySelector('.fcount');
    var listEl = inter.querySelector('.fblist');
    var contEl = inter.querySelector('[data-cont]');
    var giveEl = inter.querySelector('[data-give]');

    function reveal(id, viaGiveUp) {
      var sp = spans.filter(function (s) { return s.id === id; })[0];
      if (!sp || got[id]) return;
      got[id] = true;
      inter.querySelectorAll('.spot[data-id="' + id + '"]').forEach(function (b) {
        b.classList.add('hit'); b.disabled = true;
      });
      var sev = SEV[sp.severity] || SEV.consequential;
      listEl.appendChild(el(
        '<div class="fitem' + (viaGiveUp ? ' missed' : '') + '" data-rank="' + sev.rank + '">' +
          '<span class="sev ' + sev.cls + '">' + esc(sev.label) + '</span>' +
          '<strong>' + esc(sp.label || 'Left out') + '</strong>' + para(sp.note) + '</div>'));

      /* keep the list ordered by how badly the omission matters */
      var items = Array.prototype.slice.call(listEl.children);
      items.sort(function (a, b) {
        return (+a.getAttribute('data-rank') || 9) - (+b.getAttribute('data-rank') || 9);
      });
      items.forEach(function (n) { listEl.appendChild(n); });

      countEl.textContent = String(targets.filter(function (t) { return got[t.id]; }).length);
      finishIfDone();
    }

    function finishIfDone() {
      if (targets.filter(function (t) { return got[t.id]; }).length === targets.length) {
        contEl.hidden = false;
        giveEl.hidden = true;
        if (!self.answers[self.i]) {
          self.score.asked++;
          if (!wrongClicks) self.score.right++;
          self.answers[self.i] = { correct: !wrongClicks, detail: targets.length + '/' + targets.length };
        }
      }
    }

    inter.querySelectorAll('.spot').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.id;
        var sp = spans.filter(function (s) { return s.id === id; })[0];
        if (sp && sp.target) { reveal(id); }
        else {
          wrongClicks++;
          b.classList.add('miss');
          b.disabled = true;
          listEl.appendChild(el('<div class="fitem neutral" data-rank="9"><strong>' +
            esc((sp && sp.label) || 'This one made it in') + '</strong>' +
            para((sp && sp.note) || 'This does appear in the summary. Keep looking.') + '</div>'));
        }
      });
    });

    giveEl.addEventListener('click', function () {
      if (!self.answers[self.i]) {
        self.score.asked++;
        self.answers[self.i] = { correct: false, detail: 'revealed' };
      }
      targets.forEach(function (t) { reveal(t.id, true); });
      contEl.hidden = false;
      giveEl.hidden = true;
    });

    this.wireCont(inter);
  };

  /* ---- terminal ---- */
  Runner.prototype.step_terminal = function (inter, step) {
    var self = this;
    var tasks = step.tasks || [];
    var idx = 0;

    inter.innerHTML =
      (step.prompt ? '<div class="prompt">' + fmt(step.prompt) + '</div>' : '') +
      '<div class="term"><div class="termout" id="termout"></div>' +
      '<div class="termline"><span class="ps1">' + esc(step.prompt1 || '$') + '</span>' +
      '<input id="termin" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
      'aria-label="Terminal command"></div></div>' +
      '<div class="termhint" id="termhint"></div>' +
      '<div class="acts"><button class="primary" type="button" data-cont hidden>Continue</button></div>';

    var out = inter.querySelector('#termout');
    var input = inter.querySelector('#termin');
    var hint = inter.querySelector('#termhint');
    var contEl = inter.querySelector('[data-cont]');

    function write(lines, cls) {
      (Array.isArray(lines) ? lines : [lines]).forEach(function (l) {
        out.appendChild(el('<div class="tl' + (cls ? ' ' + cls : '') + '">' + esc(l) + '</div>'));
      });
      out.scrollTop = out.scrollHeight;
    }

    (step.prelude || []).forEach(function (l) { write(l, 'dim'); });

    function showHint() {
      hint.innerHTML = idx < tasks.length
        ? '<strong>Next:</strong> ' + fmt(tasks[idx].hint)
        : '';
    }
    showHint();

    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var cmd = input.value.trim();
      if (!cmd) return;
      write((step.prompt1 || '$') + ' ' + cmd, 'cmd');
      input.value = '';

      if (idx >= tasks.length) { write('Nothing left to do here.', 'dim'); return; }

      var t = tasks[idx];
      var ok;
      try { ok = new RegExp(t.accept, 'i').test(cmd); }
      catch (err) { ok = cmd === t.accept; }

      if (ok) {
        write(t.output || [], '');
        if (t.note) write(t.note, 'note');
        idx++;
        showHint();
        self.score.asked++;
        self.score.right++;
        if (idx >= tasks.length) {
          self.answers[self.i] = { correct: true };
          contEl.hidden = false;
          write(step.done || 'Done.', 'ok');
        }
      } else {
        write(t.reject || ('command not found: ' + cmd.split(/\s+/)[0]), 'err');
        if (t.nudge) write(t.nudge, 'dim');
      }
    });

    setTimeout(function () { input.focus(); }, 120);
    this.wireCont(inter);
  };

  /* ---- reveal: an action, then the consequence ---- */
  Runner.prototype.step_reveal = function (inter, step) {
    var self = this;
    inter.innerHTML =
      (step.prompt ? '<div class="prompt">' + fmt(step.prompt) + '</div>' : '') +
      '<div class="acts"><button class="primary" type="button" data-do>' +
      esc(step.action || 'Do it') + '</button></div>' +
      '<div class="revealed" hidden></div>';

    inter.querySelector('[data-do]').addEventListener('click', function () {
      this.disabled = true;
      this.textContent = step.actionDone || 'Done';
      var box = inter.querySelector('.revealed');
      box.hidden = false;
      box.innerHTML = '<div class="revhead">' + fmt(step.revealTitle || 'Here is what actually happened') + '</div>' +
        renderArtifact(step.revealArtifact) + para(step.reveal) +
        '<div class="acts"><button class="primary" type="button" data-cont>Continue</button></div>';
      /* Un-hide any text sitting under a redaction box in the artifact above */
      self.mount.querySelectorAll('.redbox').forEach(function (b) { b.classList.add('lifted'); });
      self.wireCont(box);
      box.querySelector('[data-cont]').focus();
    });
  };

  /* ---- summary ---- */
  Runner.prototype.renderSummary = function () {
    var self = this;
    var s = this.score;
    var pct = s.asked ? Math.round((s.right / s.asked) * 100) : 100;
    var missed = [];
    Object.keys(this.answers).forEach(function (k) {
      if (!self.answers[k].correct) {
        var st = self.s.steps[+k];
        missed.push(st && st.title ? st.title : 'Step ' + (+k + 1));
      }
    });

    this.mount.innerHTML =
      '<div class="run"><div class="runbar">' +
        '<button class="rb back" type="button" data-nav="back">&larr; All scenarios</button>' +
        '<div class="rprog"><div class="rprogfill" style="width:100%"></div></div>' +
        '<div class="rcount">Complete</div>' +
      '</div>' +
      '<div class="runbody summary">' +
        '<div class="ring" style="--pct:' + pct + '"><span>' + pct + '<small>%</small></span></div>' +
        '<h2>' + esc(this.s.title) + '</h2>' +
        '<p class="sline">' + s.right + ' of ' + s.asked + ' judgement calls correct</p>' +
        (this.s.takeaway ? '<div class="takeaway"><div class="tkhead">The point of this one</div>' +
          para(this.s.takeaway) + '</div>' : '') +
        (missed.length
          ? '<div class="review"><div class="tkhead">Worth going back over</div><ul>' +
            missed.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>'
          : '<div class="review clean">Nothing to go back over. Clean run.</div>') +
        '<div class="acts">' +
          '<button class="primary" type="button" data-again>Run it again</button>' +
          '<button class="ghost" type="button" data-nav="back">Back to all scenarios</button>' +
        '</div>' +
      '</div></div>';

    this.mount.querySelectorAll('[data-nav="back"]').forEach(function (b) {
      b.addEventListener('click', function () { if (self.opts.onExit) self.opts.onExit(); });
    });
    this.mount.querySelector('[data-again]').addEventListener('click', function () {
      self.answers = {}; self.score = { asked: 0, right: 0 }; self.go(0);
    });
  };

  root.MCCScenario = {
    Runner: Runner,
    renderArtifact: renderArtifact,
    fmt: fmt,
    progress: function () {
      try { return JSON.parse(localStorage.getItem('mcc-scenarios') || '{}'); }
      catch (e) { return {}; }
    },
    reset: function () {
      try { localStorage.removeItem('mcc-scenarios'); } catch (e) {}
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
