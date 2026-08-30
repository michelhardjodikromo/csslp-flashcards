/* CSSLP exam engine — vanilla, no framework. Self-contained: it wires up any
   element with [data-exam-launch], renders into #examRoot, and hides the host
   flashcard UI via body.exam-open. Question pools are sampled per attempt and
   options are shuffled, so no two runs are identical. */
(() => {
  'use strict';

  const root = document.getElementById('examRoot');
  if (!root) return;

  let data = null;          // exams.json
  let studyMode = true;     // true = Study, false = Exam (quizzes); mock is always exam
  let run = null;           // active attempt state
  let timer = null;

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const letter = (i) => String.fromCharCode(65 + i);

  // Prepare a question: shuffle options, remap the correct indices.
  function prep(src, domain) {
    const idx = shuffle(src.options.map((_, i) => i));
    const options = idx.map((i) => src.options[i]);
    const correct = new Set(idx.map((orig, pos) => [orig, pos]).filter(([orig]) => src.correct.includes(orig)).map(([, pos]) => pos));
    return { q: src.q, options, correct, explanation: src.explanation, tip: src.tip || '', domainId: domain.id, domainName: domain.name, sel: new Set(), answered: false };
  }

  function open() {
    document.body.classList.add('exam-open');
    root.hidden = false;
    home();
  }
  function close() {
    stopTimer();
    run = null;
    root.hidden = true;
    root.innerHTML = '';
    document.body.classList.remove('exam-open');
  }

  function shell(inner) { root.innerHTML = `<div class="exam-inner">${inner}</div>`; }

  // ── Home ────────────────────────────────────────────────────────────
  function home() {
    stopTimer();
    const domains = data.domains;
    const quizzes = domains.map((d) => `
      <button class="exam-card" data-quiz="${d.id}">
        <span><span class="t">Domain ${d.num}: ${d.name}</span><br><span class="d">${d.pool.length} questions in pool</span></span>
        <span aria-hidden="true">›</span>
      </button>`).join('');
    const mockCount = Math.min(data.mock.count, domains.reduce((n, d) => n + d.pool.length, 0));
    shell(`
      <div class="exam-head">
        <button class="exam-close" data-close aria-label="Close exams">&times;</button>
        <span class="exam-title">Practice exams</span>
      </div>
      <div class="exam-body">
        <p class="exam-home-title">Test yourself</p>
        <p class="exam-home-sub">Questions are drawn from a larger pool and reshuffled every attempt, so each run is different.</p>
        <div class="exam-moderow">
          <span>Quiz mode:</span>
          <span class="exam-seg-toggle">
            <button data-mode="study" class="${studyMode ? 'on' : ''}">Study</button>
            <button data-mode="exam" class="${studyMode ? '' : 'on'}">Exam</button>
          </span>
        </div>
        <div class="exam-list">
          <button class="exam-card mock" data-mock>
            <span><span class="t">Full mock exam</span><br><span class="d">${mockCount} questions · ${data.mock.minutes} min · timed · ${Math.round(data.passMark * 100)}% to pass</span></span>
            <span aria-hidden="true">›</span>
          </button>
          ${quizzes}
        </div>
      </div>`);
  }

  // ── Start attempts ──────────────────────────────────────────────────
  function startQuiz(domainId) {
    const d = data.domains.find((x) => x.id === domainId);
    const n = Math.min(data.quiz.count, d.pool.length);
    const questions = shuffle(d.pool).slice(0, n).map((s) => prep(s, d));
    run = { type: 'quiz', mode: studyMode ? 'study' : 'exam', title: `Domain ${d.num} quiz`, questions, pos: 0, endsAt: 0 };
    renderQuestion();
  }
  function startMock() {
    const all = [];
    data.domains.forEach((d) => d.pool.forEach((s) => all.push([s, d])));
    const n = Math.min(data.mock.count, all.length);
    const questions = shuffle(all).slice(0, n).map(([s, d]) => prep(s, d));
    run = { type: 'mock', mode: 'exam', title: 'Full mock exam', questions, pos: 0, endsAt: Date.now() + data.mock.minutes * 60000 };
    startTimer();
    renderQuestion();
  }

  // ── Timer (mock) ──────────────────────────────────────────────────────
  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      const left = Math.max(0, run.endsAt - Date.now());
      const t = document.querySelector('.exam-timer');
      if (t) {
        const s = Math.floor(left / 1000);
        t.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        t.classList.toggle('low', s <= 300);
      }
      if (left <= 0) { stopTimer(); finish(); }
    }, 500);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  // ── Question view ─────────────────────────────────────────────────────
  function renderQuestion() {
    const q = run.questions[run.pos];
    const multi = q.correct.size > 1;
    const total = run.questions.length;
    const segs = run.questions.map((qq, i) =>
      `<span class="exam-seg ${i === run.pos ? 'current' : (qq.answered ? 'done' : '')}"></span>`).join('');

    const opts = q.options.map((opt, i) => {
      let cls = 'exam-opt' + (multi ? ' multi' : '');
      if (q.answered && run.mode === 'study') {
        if (q.correct.has(i)) cls += ' correct';
        else if (q.sel.has(i)) cls += ' wrong';
      } else if (q.sel.has(i)) cls += ' selected';
      const mk = multi ? (q.sel.has(i) ? '✓' : '') : letter(i);
      return `<button class="${cls}" data-opt="${i}" ${q.answered && run.mode === 'study' ? 'disabled' : ''}>
        <span class="mark">${mk}</span><span>${opt}</span></button>`;
    }).join('');

    const timerHtml = run.type === 'mock' ? `<span class="exam-timer">--:--</span>` : '';
    const feedback = (q.answered && run.mode === 'study') ? explainHtml(q) : '';
    const last = run.pos === total - 1;
    const canAdvance = run.mode === 'exam' ? true : q.answered;
    const advLabel = last ? 'Finish' : 'Next';
    const footer = (run.mode === 'study' && !q.answered)
      ? (multi ? `<button class="exam-btn" data-check ${q.sel.size ? '' : 'disabled'}>Check answer</button>` : `<span class="exam-count" style="align-self:center">Select an answer</span>`)
      : `<button class="exam-btn" data-next ${canAdvance ? '' : 'disabled'}>${advLabel}</button>`;

    shell(`
      <div class="exam-head">
        <button class="exam-close" data-close aria-label="Close exam">&times;</button>
        <span class="exam-title">${run.title}</span>
        ${timerHtml}
      </div>
      <div class="exam-progress">
        <span class="exam-count">Question ${run.pos + 1} of ${total}</span>
        <div class="exam-bar"><div class="exam-bar-fill" style="width:${((run.pos + (q.answered ? 1 : 0)) / total) * 100}%"></div></div>
        <div class="exam-track">${segs}</div>
      </div>
      <div class="exam-body">
        <div class="exam-qgrid">
          <div class="exam-qcol">
            <p class="exam-domain">Domain ${q.domainName}</p>
            <p class="exam-q">${q.q}</p>
            ${multi ? `<p class="exam-choose">Choose ${q.correct.size}.</p>` : ''}
          </div>
          <div class="exam-ocol">
            <div class="exam-options">${opts}</div>
          </div>
        </div>
        ${feedback}
      </div>
      <div class="exam-foot">${footer}</div>`);
    if (run.type === 'mock') startTimer();
  }

  function explainHtml(q) {
    const ok = setsEqual(q.sel, q.correct);
    return `<div class="exam-explain">
      <p class="verdict ${ok ? 'ok' : 'no'}">${ok ? 'Correct' : 'Not quite'}</p>
      <p>${q.explanation}</p>
      ${q.tip ? `<p class="tip">Tip: ${q.tip}</p>` : ''}
    </div>`;
  }

  function selectOption(i) {
    const q = run.questions[run.pos];
    const multi = q.correct.size > 1;
    if (q.answered && run.mode === 'study') return;
    if (multi) {
      q.sel.has(i) ? q.sel.delete(i) : q.sel.add(i);
    } else {
      q.sel = new Set([i]);
      if (run.mode === 'study') { q.answered = true; }
    }
    renderQuestion();
  }

  function setsEqual(a, b) { return a.size === b.size && [...a].every((x) => b.has(x)); }

  // ── Results + review ──────────────────────────────────────────────────
  function finish() {
    stopTimer();
    run.questions.forEach((q) => { q.answered = true; });
    const correct = run.questions.filter((q) => setsEqual(q.sel, q.correct)).length;
    const total = run.questions.length;
    const pct = Math.round((correct / total) * 100);
    const passed = correct / total >= data.passMark;

    let breakdown = '';
    if (run.type === 'mock') {
      const by = {};
      run.questions.forEach((q) => {
        by[q.domainName] = by[q.domainName] || { c: 0, t: 0 };
        by[q.domainName].t++;
        if (setsEqual(q.sel, q.correct)) by[q.domainName].c++;
      });
      breakdown = `<div class="exam-break">${Object.entries(by).map(([name, v]) =>
        `<div class="row"><span class="lbl">${name}</span><span class="mini"><span style="width:${(v.c / v.t) * 100}%"></span></span><span class="val">${v.c}/${v.t}</span></div>`).join('')}</div>`;
    }

    shell(`
      <div class="exam-head">
        <button class="exam-close" data-close aria-label="Close">&times;</button>
        <span class="exam-title">${run.title} — results</span>
      </div>
      <div class="exam-body">
        <p class="exam-result-score">${pct}%</p>
        <span class="exam-result-badge ${passed ? 'pass' : 'fail'}">${passed ? 'PASS' : 'BELOW PASS'}</span>
        <p class="exam-home-sub" style="margin-top:0.8rem">${correct} of ${total} correct · pass mark ${Math.round(data.passMark * 100)}%</p>
        ${breakdown}
      </div>
      <div class="exam-foot">
        <button class="exam-btn ghost" data-review>Review answers</button>
        <button class="exam-btn" data-home>Back to exams</button>
      </div>`);
  }

  function review() {
    const items = run.questions.map((q, i) => {
      const yours = [...q.sel].sort().map((x) => letter(x)).join(', ') || '—';
      const right = [...q.correct].sort().map((x) => letter(x)).join(', ');
      const ok = setsEqual(q.sel, q.correct);
      const optLines = q.options.map((o, oi) => `${letter(oi)}. ${o}`).join('<br>');
      return `<div class="rq">
        <p class="qt">${i + 1}. ${q.q}</p>
        <p class="ln">${optLines}</p>
        <p class="ln ${ok ? 'ok' : 'no'}">Your answer: ${yours} ${ok ? '✓' : '✗'}</p>
        ${ok ? '' : `<p class="ln ok">Correct: ${right}</p>`}
        <p class="ex">${q.explanation}</p>
      </div>`;
    }).join('');
    shell(`
      <div class="exam-head">
        <button class="exam-close" data-close aria-label="Close">&times;</button>
        <span class="exam-title">Review</span>
      </div>
      <div class="exam-body"><div class="exam-review">${items}</div></div>
      <div class="exam-foot"><button class="exam-btn" data-home>Back to exams</button></div>`);
  }

  // ── Event delegation ──────────────────────────────────────────────────
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-close],[data-mode],[data-quiz],[data-mock],[data-opt],[data-check],[data-next],[data-review],[data-home]');
    if (!t) return;
    if (t.dataset.close !== undefined) return close();
    if (t.dataset.mode) { studyMode = t.dataset.mode === 'study'; return home(); }
    if (t.dataset.quiz) return startQuiz(t.dataset.quiz);
    if (t.dataset.mock !== undefined) return startMock();
    if (t.dataset.opt !== undefined) return selectOption(Number(t.dataset.opt));
    if (t.dataset.check !== undefined) { run.questions[run.pos].answered = true; return renderQuestion(); }
    if (t.dataset.next !== undefined) {
      run.questions[run.pos].answered = true;
      if (run.pos === run.questions.length - 1) return finish();
      run.pos++; return renderQuestion();
    }
    if (t.dataset.review !== undefined) return review();
    if (t.dataset.home !== undefined) return home();
  });

  document.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'Escape') close();
  });

  // ── Post-flashcards nudge ─────────────────────────────────────────────
  // When every domain's flashcards have been seen (flagged by the flashcard
  // app), offer a mock exam once. Dismissible and remembered.
  function maybePrompt() {
    try {
      const allSeen = data.domains.every((d) => localStorage.getItem('csslp.fcseen.' + d.id) != null);
      if (!allSeen || localStorage.getItem('csslp.mockprompt') != null) return;
      const bar = document.createElement('div');
      bar.className = 'exam-prompt';
      bar.innerHTML = `<span>You've been through all the flashcards. Ready for a mock exam?</span>
        <span class="exam-prompt-actions">
          <button data-prompt-start class="exam-launch" type="button">Start mock</button>
          <button data-prompt-dismiss class="exam-prompt-x" type="button" aria-label="Dismiss">&times;</button>
        </span>`;
      document.body.appendChild(bar);
      bar.addEventListener('click', (e) => {
        if (e.target.closest('[data-prompt-start]')) {
          localStorage.setItem('csslp.mockprompt', 'done'); bar.remove();
          document.body.classList.add('exam-open'); root.hidden = false; startMock();
        } else if (e.target.closest('[data-prompt-dismiss]')) {
          localStorage.setItem('csslp.mockprompt', 'dismissed'); bar.remove();
        }
      });
    } catch { /* ignore */ }
  }

  // ── Boot ──────────────────────────────────────────────────────────────
  async function boot() {
    try { data = await (await fetch('exams.json')).json(); }
    catch { return; }
    document.querySelectorAll('[data-exam-launch]').forEach((b) =>
      b.addEventListener('click', (e) => { e.preventDefault(); open(); }));
    maybePrompt();
  }
  boot();
})();
