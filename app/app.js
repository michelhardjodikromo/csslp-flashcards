/* CSSLP Flashcards — APK build. Flip cards + narrated audio, landscape.
   Domains + theme live in a slide-in drawer. No progress bar; the counter
   shows the card number. No service worker (assets are bundled in the APK). */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    menuBtn: $('menuBtn'), drawer: $('drawer'), drawerScrim: $('drawerScrim'), drawerClose: $('drawerClose'),
    tabs: $('domainTabs'), domainName: $('domainName'),
    card: $('card'), front: $('frontText'), back: $('backText'),
    prev: $('prevBtn'), next: $('nextBtn'),
    speak: $('speakBtn'),
    counter: $('counter'),
    shuffle: $('shuffleBtn'), auto: $('autoBtn'),
    theme: $('themeToggle'), themeLabel: $('themeLabel'), status: $('status'),
  };

  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem('csslp.' + k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('csslp.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
  };

  let deck = null, domain = null, order = [], pos = 0;
  let flipped = false, shuffled = false, autoplay = false;
  const audio = new Audio();
  let gapTimer = null;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Theme (System / Light / Dark) ────────────────────────────────────
  const THEMES = ['system', 'light', 'dark'];
  function applyTheme(mode) {
    if (mode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    el.themeLabel.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    store.set('theme', mode);
  }
  el.theme.addEventListener('click', () => {
    const cur = store.get('theme', 'system');
    applyTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
  });
  applyTheme(store.get('theme', 'system'));

  // ── Drawer ────────────────────────────────────────────────────────────
  function openDrawer() { el.drawer.hidden = false; el.menuBtn.setAttribute('aria-expanded', 'true'); }
  function closeDrawer() { el.drawer.hidden = true; el.menuBtn.setAttribute('aria-expanded', 'false'); }
  el.menuBtn.addEventListener('click', openDrawer);
  el.drawerClose.addEventListener('click', closeDrawer);
  el.drawerScrim.addEventListener('click', closeDrawer);

  // ── Audio ────────────────────────────────────────────────────────────
  function stopAudio() {
    clearTimeout(gapTimer);
    audio.onended = null; audio.onerror = null; audio.pause();
    el.speak.classList.remove('playing');
  }
  function currentCard() { return domain.cards[order[pos]]; }
  function playSide(side, onDone) {
    stopAudio();
    const card = currentCard();
    el.speak.classList.add('playing');
    audio.src = side === 'front' ? card.q : card.a;
    audio.onended = () => { el.speak.classList.remove('playing'); onDone && onDone(); };
    audio.onerror = () => { el.speak.classList.remove('playing'); setStatus('Audio unavailable.'); onDone && onDone(); };
    audio.play().catch(() => { el.speak.classList.remove('playing'); onDone && onDone(); });
  }

  // ── Autoplay: question -> flip -> answer -> next ─────────────────────
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
            go(pos + 1); runAutoplay();
          }, 1400);
        });
      }, 500);
    });
  }
  function setAutoplay(on) {
    autoplay = on; el.auto.setAttribute('aria-pressed', String(on));
    if (on) runAutoplay(); else stopAudio();
  }
  el.auto.addEventListener('click', () => setAutoplay(!autoplay));

  // ── Card ──────────────────────────────────────────────────────────────
  function setFlipped(v) {
    flipped = v; el.card.classList.toggle('flipped', v);
    el.speak.setAttribute('aria-label', v ? 'Play answer' : 'Play question');
  }
  function render() {
    const card = currentCard();
    el.front.textContent = card.front;
    el.back.textContent = card.back;
    el.counter.textContent = `${pos + 1} / ${order.length}`;
    el.prev.disabled = pos === 0;
    el.next.disabled = pos === order.length - 1;
    setStatus('');
    if (pos === order.length - 1 && domain) store.set('fcseen.' + domain.id, 1);
  }
  function go(newPos, keepFlip) {
    pos = Math.max(0, Math.min(order.length - 1, newPos));
    if (!keepFlip) setFlipped(false);
    if (!autoplay) stopAudio();
    render();
    store.set('pos.' + domain.id, order[pos]);
  }

  // ── Domains ─────────────────────────────────────────────────────────
  function buildOrder() {
    order = domain.cards.map((_, i) => i);
    if (shuffled) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
  }
  function loadDomain(domId, resume) {
    setAutoplay(false);
    domain = deck.domains.find((d) => d.id === domId) || deck.domains[0];
    shuffled = false; el.shuffle.setAttribute('aria-pressed', 'false');
    buildOrder();
    el.domainName.textContent = `Domain ${domain.num} · ${domain.name}`;
    for (const t of el.tabs.children) t.classList.toggle('active', t.dataset.id === domain.id);
    const saved = resume ? store.get('pos.' + domain.id, 0) : 0;
    pos = Math.max(0, order.indexOf(saved));
    setFlipped(false); render();
    store.set('domain', domain.id);
  }
  el.shuffle.addEventListener('click', () => {
    shuffled = !shuffled; el.shuffle.setAttribute('aria-pressed', String(shuffled));
    setAutoplay(false);
    const keep = order[pos]; buildOrder();
    pos = shuffled ? 0 : Math.max(0, order.indexOf(keep));
    setFlipped(false); render();
  });

  // ── Controls ──────────────────────────────────────────────────────────
  el.card.addEventListener('click', () => { if (autoplay) { setAutoplay(false); return; } setFlipped(!flipped); });
  el.speak.addEventListener('click', (e) => {
    e.stopPropagation();
    if (el.speak.classList.contains('playing')) { stopAudio(); return; }
    if (autoplay) setAutoplay(false);
    playSide(flipped ? 'back' : 'front');
  });
  el.prev.addEventListener('click', () => { setAutoplay(false); go(pos - 1); });
  el.next.addEventListener('click', () => { setAutoplay(false); go(pos + 1); });
  document.addEventListener('keydown', (e) => {
    if (!el.drawer.hidden && e.key === 'Escape') { closeDrawer(); return; }
    if (e.key === ' ') { e.preventDefault(); setAutoplay(false); setFlipped(!flipped); }
    else if (e.key === 'ArrowLeft') { setAutoplay(false); go(pos - 1); }
    else if (e.key === 'ArrowRight') { setAutoplay(false); go(pos + 1); }
  });
  function setStatus(msg) { el.status.textContent = msg; }

  // ── Boot ──────────────────────────────────────────────────────────────
  async function boot() {
    try { deck = await (await fetch('cards.json')).json(); }
    catch { setStatus('Could not load the deck.'); return; }
    for (const d of deck.domains) {
      const btn = document.createElement('button');
      btn.className = 'tab'; btn.type = 'button'; btn.dataset.id = d.id;
      btn.innerHTML = `<span class="tnum">D${d.num}</span><span>${d.name}</span>`;
      btn.addEventListener('click', () => { loadDomain(d.id, false); closeDrawer(); });
      el.tabs.appendChild(btn);
    }
    if (prefersReduced) el.card.querySelector('.card-inner').style.transition = 'none';
    loadDomain(store.get('domain', deck.domains[0].id), true);
  }
  boot();
})();
