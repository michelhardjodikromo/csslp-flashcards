/* CSSLP Flashcards — flip cards + narrated audio. No framework, no build. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    tabs: $('domainTabs'), domainName: $('domainName'),
    card: $('card'), front: $('frontText'), back: $('backText'),
    prev: $('prevBtn'), next: $('nextBtn'),
    speak: $('speakBtn'), speakLabel: $('speakLabel'),
    counter: $('counter'), progress: $('progressFill'),
    shuffle: $('shuffleBtn'), auto: $('autoBtn'),
    theme: $('themeToggle'), status: $('status'),
  };

  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem('csslp.' + k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('csslp.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
  };

  let deck = null;        // full data
  let domain = null;      // active domain object
  let order = [];         // indexes into domain.cards (supports shuffle)
  let pos = 0;            // position within order
  let flipped = false;
  let shuffled = false;
  let autoplay = false;

  const audio = new Audio();
  let gapTimer = null;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Theme ────────────────────────────────────────────────────────────
  function applyTheme(mode) {
    if (mode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    store.set('theme', mode);
  }
  el.theme.addEventListener('click', () => {
    const current = store.get('theme', 'system');
    const isDark = current === 'dark' ||
      (current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyTheme(isDark ? 'light' : 'dark');
  });
  applyTheme(store.get('theme', 'system'));

  // ── Audio ────────────────────────────────────────────────────────────
  function stopAudio() {
    clearTimeout(gapTimer);
    audio.onended = null; audio.onerror = null;
    audio.pause();
    el.speak.classList.remove('playing');
  }

  function currentCard() { return domain.cards[order[pos]]; }

  function playSide(side, onDone) {
    stopAudio();
    const card = currentCard();
    const src = side === 'front' ? card.q : card.a;
    el.speak.classList.add('playing');
    audio.src = src;
    audio.onended = () => { el.speak.classList.remove('playing'); onDone && onDone(); };
    audio.onerror = () => {
      el.speak.classList.remove('playing');
      setStatus('Audio unavailable for this card.');
      onDone && onDone();
    };
    audio.play().catch(() => {
      el.speak.classList.remove('playing');
      onDone && onDone();
    });
  }

  // ── Autoplay: question -> flip -> answer -> next card ─────────────────
  function runAutoplay() {
    if (!autoplay) return;
    setFlipped(false);
    playSide('front', () => {
      if (!autoplay) return;
      gapTimer = setTimeout(() => {
        setFlipped(true);
        playSide('back', () => {
          if (!autoplay) return;
          gapTimer = setTimeout(() => {
            if (pos + 1 >= order.length) { setAutoplay(false); return; }
            go(pos + 1);
            runAutoplay();
          }, 1400);
        });
      }, 500);
    });
  }

  function setAutoplay(on) {
    autoplay = on;
    el.auto.setAttribute('aria-pressed', String(on));
    if (on) { runAutoplay(); } else { stopAudio(); }
  }
  el.auto.addEventListener('click', () => setAutoplay(!autoplay));

  // ── Card rendering ────────────────────────────────────────────────────
  function setFlipped(v) {
    flipped = v;
    el.card.classList.toggle('flipped', v);
    el.speakLabel.textContent = v ? 'Play answer' : 'Play question';
  }

  function render() {
    const card = currentCard();
    el.front.textContent = card.front;
    el.back.textContent = card.back;
    el.counter.textContent = `${pos + 1} / ${order.length}`;
    el.progress.style.width = `${((pos + 1) / order.length) * 100}%`;
    el.prev.disabled = pos === 0;
    el.next.disabled = pos === order.length - 1;
    setStatus('');
    // Mark this domain's flashcards as seen once the last card is reached
    // (used by exam.js to offer a mock exam when all domains are done).
    if (pos === order.length - 1 && domain) store.set('fcseen.' + domain.id, 1);
  }

  function go(newPos, keepFlip) {
    pos = Math.max(0, Math.min(order.length - 1, newPos));
    if (!keepFlip) setFlipped(false);
    if (!autoplay) stopAudio();
    render();
    store.set('pos.' + domain.id, order[pos]);
  }

  // ── Domain switching ──────────────────────────────────────────────────
  function buildOrder() {
    order = domain.cards.map((_, i) => i);
    if (shuffled) {
      // Fisher-Yates
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
  }

  function loadDomain(domId, resume) {
    setAutoplay(false);
    domain = deck.domains.find((d) => d.id === domId) || deck.domains[0];
    shuffled = false;
    el.shuffle.setAttribute('aria-pressed', 'false');
    buildOrder();
    el.domainName.textContent = `Domain ${domain.num} · ${domain.name}`;
    for (const t of el.tabs.children) t.classList.toggle('active', t.dataset.id === domain.id);
    const savedCard = resume ? store.get('pos.' + domain.id, 0) : 0;
    pos = Math.max(0, order.indexOf(savedCard));
    if (pos < 0) pos = 0;
    setFlipped(false);
    render();
    store.set('domain', domain.id);
  }

  el.shuffle.addEventListener('click', () => {
    shuffled = !shuffled;
    el.shuffle.setAttribute('aria-pressed', String(shuffled));
    setAutoplay(false);
    const keepId = order[pos];
    buildOrder();
    pos = shuffled ? 0 : Math.max(0, order.indexOf(keepId));
    setFlipped(false);
    render();
  });

  // ── Controls ──────────────────────────────────────────────────────────
  el.card.addEventListener('click', () => {
    if (autoplay) { setAutoplay(false); return; }
    setFlipped(!flipped);
  });
  el.speak.addEventListener('click', (e) => {
    e.stopPropagation();
    if (el.speak.classList.contains('playing')) { stopAudio(); return; }
    if (autoplay) setAutoplay(false);
    playSide(flipped ? 'back' : 'front');
  });
  el.prev.addEventListener('click', () => { setAutoplay(false); go(pos - 1); });
  el.next.addEventListener('click', () => { setAutoplay(false); go(pos + 1); });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'BUTTON' && e.key === 'Enter') return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setAutoplay(false); setFlipped(!flipped); }
    else if (e.key === 'ArrowLeft') { setAutoplay(false); go(pos - 1); }
    else if (e.key === 'ArrowRight') { setAutoplay(false); go(pos + 1); }
    else if (e.key.toLowerCase() === 'p') { el.speak.click(); }
  });

  function setStatus(msg) { el.status.textContent = msg; }

  // ── Boot ──────────────────────────────────────────────────────────────
  async function boot() {
    try {
      const res = await fetch('cards.json');
      deck = await res.json();
    } catch {
      setStatus('Could not load the deck. Check your connection and reload.');
      return;
    }
    for (const d of deck.domains) {
      const btn = document.createElement('button');
      btn.className = 'tab';
      btn.type = 'button';
      btn.dataset.id = d.id;
      btn.textContent = `D${d.num}`;
      btn.title = d.name;
      btn.addEventListener('click', () => loadDomain(d.id, false));
      el.tabs.appendChild(btn);
    }
    if (prefersReduced) el.card.querySelector('.card-inner').style.transition = 'none';
    loadDomain(store.get('domain', deck.domains[0].id), true);
  }

  boot();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
