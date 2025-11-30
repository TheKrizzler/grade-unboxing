// Grade Unboxing content script
// Finds grade spans in the results table, hides them, and replaces with an "Open Case" button.
// When clicked, a case-opening overlay plays an animation cycling through grade options and
// finally reveals the real grade.

(() => {
  const GRADE_OPTIONS = ['A','B','C','D','E','F'];

  function log(...args){
    // console.debug('GradeUnboxing:', ...args);
  }

  function queryGradeSpans() {
    // select grade spans in result rows; pattern observed in site HTML
    return Array.from(document.querySelectorAll('tr.resultatTop .col6Resultat .infoLinje span'));
  }

  function processSpan(span) {
    if (!span || span.dataset.guProcessed) return;
    span.dataset.guProcessed = '1';

    const real = span.textContent.trim();
    span.dataset.guRealGrade = real;

    // clear existing content
    span.textContent = '';

    const btn = document.createElement('button');
    btn.className = 'gu-open-case-btn';
    btn.textContent = 'Open case';
    btn.title = 'Open case to reveal grade';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      showCaseAnimation(span, real);
    });

    span.appendChild(btn);
  }

  function observeAndProcess() {
    const run = () => {
      const spans = queryGradeSpans();
      spans.forEach(processSpan);
    };

    run();

    const mo = new MutationObserver((records) => {
      run();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function buildSequence(finalGrade) {
    const seq = [];
    // produce a moderately sized pseudo-random list of grades. We'll choose
    // a tentative selection index (where a small celebration happens) before
    // the final reveal at the very end. This keeps the animation reasonably
    // short but makes it unclear which occurrence is the actual final reveal.
    const total = 24; // total cards (not including final reveal)
    for (let i = 0; i < total; i++) {
      seq.push(GRADE_OPTIONS[Math.floor(Math.random() * GRADE_OPTIONS.length)]);
    }

    // choose a tentative selection index somewhere in the last quarter (but not the last element)
    const tentativeIndex = Math.floor(total * (0.6 + Math.random() * 0.25));
    seq[tentativeIndex] = finalGrade; // ensure a visible candidate

    // now push the actual reveal card and record its index
    seq.push(finalGrade);
    const finalIndex = seq.length - 1;

    // add a small padding of random grades after the reveal so the rail doesn't end abruptly
    const paddingCount = 4;
    for (let p = 0; p < paddingCount; p++) {
      seq.push(GRADE_OPTIONS[Math.floor(Math.random() * GRADE_OPTIONS.length)]);
    }

    // attach metadata so caller can inspect indices
    seq._tentativeIndex = tentativeIndex;
    seq._finalIndex = finalIndex;
    return seq;
  }

  function showCaseAnimation(targetSpan, finalGrade) {
    // create overlay
    if (document.querySelector('.gu-overlay')) return; // avoid multiple overlays

    const overlay = document.createElement('div');
    overlay.className = 'gu-overlay';

    overlay.innerHTML = `
      <div class="gu-panel" role="dialog" aria-modal="true">
        <div class="gu-title">Unboxing...</div>
        <div class="gu-stage">
          <div class="gu-rail"></div>
        </div>
        <div class="gu-controls">
          <button class="gu-skip">Reveal</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const rail = overlay.querySelector('.gu-rail');
    const seq = buildSequence(finalGrade);
    const tentativeIndex = seq._tentativeIndex || -1;
    const finalIndex = seq._finalIndex != null ? seq._finalIndex : (seq.length - 1);
    let revealed = false;

    // create card elements using per-grade SVG art when available
    seq.forEach((g, i) => {
      const card = document.createElement('div');
      card.className = 'gu-card';
      card.dataset.guIndex = i;

      // try to load an asset SVG for the grade
      try {
        const img = document.createElement('img');
        // chrome.runtime.getURL is available in content scripts for extensions
        img.src = chrome && chrome.runtime && chrome.runtime.getURL
          ? chrome.runtime.getURL(`assets/grades/grade-${g}.svg`)
          : `assets/grades/grade-${g}.svg`;
        img.alt = g;
        img.className = 'gu-card-img';
        card.appendChild(img);
      } catch (e) {
        card.textContent = g; // fallback to text
      }

      rail.appendChild(card);
    });

    // compute animation timeline: we'll scroll the rail left-to-right by setting transform
    const cards = Array.from(rail.children);
    const cardWidth = 120; // CSS is sized to match
    const totalWidth = cards.length * cardWidth;
    rail.style.width = `${totalWidth}px`;

    // audio: create a simple WebAudio context for ticks and reveal chime
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = AudioContext ? new AudioContext() : null;

    // improved procedural sounds (no external audio files)
    function playTick() {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      // short filtered noise for percussive click
      const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.03, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.06, now + 0.005);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1200 + Math.random() * 800;
      noise.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noise.start(now);
      noise.stop(now + 0.06);

      // a short tonal click to add pitch information
      const o = audioCtx.createOscillator();
      const og = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = 1000 + Math.random() * 600;
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(0.08, now + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      o.connect(og);
      og.connect(audioCtx.destination);
      o.start(now);
      o.stop(now + 0.06);
    }

    function playReveal() {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      g.connect(audioCtx.destination);

      // two slightly detuned sine oscillators for a pleasant bell-like chord
      const o1 = audioCtx.createOscillator();
      const o2 = audioCtx.createOscillator();
      o1.type = 'sine'; o2.type = 'sine';
      o1.frequency.value = 660; o2.frequency.value = 990;
      o2.detune.value = 8;
      o1.connect(g); o2.connect(g);
      o1.start(now); o2.start(now + 0.01);
      o1.stop(now + 0.9); o2.stop(now + 0.95);

      // gentle metallic overtone using FM-style oscillator
      const carrier = audioCtx.createOscillator();
      const mod = audioCtx.createOscillator();
      const modGain = audioCtx.createGain();
      mod.type = 'sine'; carrier.type = 'sine';
      mod.frequency.value = 220; modGain.gain.value = 40;
      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.frequency.value = 420;
      const cg = audioCtx.createGain();
      cg.gain.setValueAtTime(0.0001, now);
      cg.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
      cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      carrier.connect(cg);
      cg.connect(audioCtx.destination);
      mod.start(now); carrier.start(now);
      mod.stop(now + 0.9); carrier.stop(now + 0.95);
    }

    function playSmallPing() {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.06, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(now); o.stop(now + 0.2);
    }

    // initial offset so the scroll starts with first card visible in center
    const viewport = overlay.querySelector('.gu-stage');

    let idx = 0;
    let speed = 90; // ms between steps (slower base for extended suspense)
    let steps = seq.length;

    function step() {
      idx++;
      if (idx >= steps) {
        finish();
        return;
      }
      const offset = Math.max(0, idx * cardWidth - viewport.clientWidth / 2 + cardWidth / 2);
      rail.style.transform = `translateX(${-offset}px)`;

      // highlight the current centered card slightly to create motion clarity
      const cards = Array.from(rail.children);
      const curIndex = Math.min(cards.length - 1, idx);
      cards.forEach((c, i) => c.classList.toggle('gu-card-current', i === curIndex));

      // play a tick sound on each step
      playTick();

      // if we hit the tentative selection index, play a small celebration
      if (idx === tentativeIndex) {
        const candidate = cards[curIndex];
        if (candidate) {
          candidate.classList.add('gu-card-candidate');
          playSmallPing();
          setTimeout(() => candidate.classList.remove('gu-card-candidate'), 340);
        }
      }

      // if we reached the final reveal index and haven't revealed yet, reveal now and stop scrolling
      if (idx === finalIndex && !revealed) {
        revealNow();
        return; // stop the animation loop
      }

      // gradually slow down when nearing the end (increased increments for strong build-up)
      if (idx > steps * 0.45) speed += 20 + Math.floor((idx / steps) * 35);

      setTimeout(step, speed);
    }

    // start after a tiny delay so users see initial state
    setTimeout(() => setTimeout(step, speed), 200);

    function finish() {
      // simply remove overlay (reveal already handled at reveal index)
      overlay.remove();
    }

    function revealNow() {
      revealed = true;
      // reveal final grade in the original span
      targetSpan.textContent = finalGrade;

      // visually mark the final card (use recorded finalIndex)
      const cards = Array.from(rail.children);
      const finalCard = cards[finalIndex];
      if (finalCard) {
        finalCard.classList.add('gu-card-selected');
        // small celebration near the final card
        createConfetti(finalCard, overlay);
      }

      playReveal();

      // close overlay shortly after reveal so celebration is visible
      setTimeout(() => overlay.remove(), 500);
    }

    function createConfetti(cardEl, container) {
      const rect = cardEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      // compute coordinates relative to container
      const cx = rect.left - containerRect.left + rect.width / 2;
      const cy = rect.top - containerRect.top + rect.height / 3;

      const colors = ['#FFD100', '#FF6B6B', '#6EE7B7', '#60A5FA', '#A78BFA'];
      for (let i = 0; i < 20; i++) {
        const d = document.createElement('div');
        d.className = 'gu-confetti';
        d.style.background = colors[i % colors.length];
        d.style.left = `${cx}px`;
        d.style.top = `${cy}px`;
        d.style.transform = `translate(-50%,-50%) rotate(${Math.random() * 360}deg)`;
        container.querySelector('.gu-panel').appendChild(d);
        // randomize animation delay
        const delay = Math.random() * 0.06;
        d.style.animationDelay = `${delay}s`;
      }
      // cleanup confetti
      setTimeout(() => {
        const cs = container.querySelectorAll('.gu-confetti');
        cs.forEach(n => n.remove());
      }, 1400);
    }

    overlay.querySelector('.gu-skip').addEventListener('click', () => {
      if (!revealed) revealNow();
      // remove overlay shortly after revealing
      setTimeout(() => overlay.remove(), 400);
    });

    // allow Escape to cancel/finish
    function onKey(e) {
      if (e.key === 'Escape') finish();
    }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('remove', () => document.removeEventListener('keydown', onKey));
  }

  // inject small style sanity check if content stylesheet fails to load
  function injectFallbackStyle() {
    if (document.getElementById('gu-fallback-style')) return;
    const s = document.createElement('style');
    s.id = 'gu-fallback-style';
    s.textContent = `
      .gu-open-case-btn{padding:6px 10px;border-radius:4px;background:#2b6bf6;color:#fff;border:none;cursor:pointer}
    `;
    document.head.appendChild(s);
  }

  // initialization
  function init() {
    observeAndProcess();
    // some sites may block CSS injection ordering; add fallback
    setTimeout(injectFallbackStyle, 2000);
  }

  // wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
