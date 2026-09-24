/*
 * Physics Quest — app shell: navigation, difficulty, quiz rounds, XP/levels, progress.
 */
(function () {
  'use strict';

  const Q = window.PhysicsQuestions;
  const ROUND_LENGTH = 10;
  const STORAGE_KEY = 'physics-quest-v1';
  const TITLES = ['Curious Mind', 'Apprentice', 'Tinkerer', 'Experimenter', 'Lab Assistant',
    'Physicist', 'Senior Physicist', 'Professor', 'Nobel Nominee', 'Einstein Mode'];

  const $ = (id) => document.getElementById(id);
  const topicById = Object.fromEntries(Q.TOPICS.map((t) => [t.id, t]));

  // ---------- persistence ----------
  function freshStats() {
    const topics = {};
    Q.TOPICS.forEach((t) => (topics[t.id] = { attempts: 0, correct: 0, recent: [] }));
    const best = {};
    Q.DIFFICULTIES.forEach((d) => (best[d.id] = null));
    return {
      xp: 0, answered: 0, correct: 0, bestStreak: 0,
      difficulty: 'beginner',
      best,
      topics,
      lab: { hits: 0, shots: 0, levels: { beginner: 1, medium: 1, hard: 1, hardcore: 1 } },
      dayStreak: 0, bestDayStreak: 0, lastDay: null,
      todayDate: null, todayCount: 0, goal: 20,
    };
  }

  function load() {
    const base = freshStats();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        Object.assign(base, saved);
        const fresh = freshStats();
        base.topics = Object.assign(fresh.topics, saved.topics || {});
        base.best = Object.assign(fresh.best, saved.best || {});
        base.lab = Object.assign(fresh.lab, saved.lab || {});
        base.lab.levels = Object.assign(fresh.lab.levels, (saved.lab && saved.lab.levels) || {});
        // Saves from before difficulty levels existed were played on what is now Medium.
        if (!saved.difficulty) {
          base.difficulty = 'medium';
          if (saved.lab && saved.lab.level) base.lab.levels.medium = saved.lab.level;
        }
        if (!Q.DIFF[base.difficulty]) base.difficulty = 'medium';
      }
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    return base;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
  }

  let stats = load();
  const diff = () => Q.DIFF[stats.difficulty];

  // ---------- dates & streaks ----------
  function dayKey(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function today() { return dayKey(new Date()); }
  function yesterday() { const d = new Date(); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)); }

  function currentDayStreak() {
    return stats.lastDay === today() || stats.lastDay === yesterday() ? stats.dayStreak : 0;
  }
  function todayCount() {
    return stats.todayDate === today() ? stats.todayCount : 0;
  }

  function touchDay() {
    const t = today();
    if (stats.lastDay !== t) {
      stats.dayStreak = stats.lastDay === yesterday() ? stats.dayStreak + 1 : 1;
      stats.lastDay = t;
      stats.bestDayStreak = Math.max(stats.bestDayStreak, stats.dayStreak);
    }
    if (stats.todayDate !== t) { stats.todayDate = t; stats.todayCount = 0; }
  }

  // ---------- XP & levels ----------
  function levelInfo(xp) {
    let level = 1, need = 100;
    while (xp >= need) { xp -= need; level++; need = 100 + (level - 1) * 50; }
    return { level, into: xp, need, title: TITLES[Math.min(level - 1, TITLES.length - 1)] };
  }

  function addXp(amount) {
    const before = levelInfo(stats.xp).level;
    stats.xp += amount;
    const after = levelInfo(stats.xp);
    if (after.level > before) toast(`⭐ Level up! You're now level ${after.level}: ${after.title}`);
  }

  function mastery(topicId) {
    const r = stats.topics[topicId].recent;
    if (!r.length) return null;
    return r.filter(Boolean).length / r.length;
  }

  function accuracyMap() {
    const m = {};
    Q.TOPICS.forEach((t) => { const v = mastery(t.id); if (v !== null) m[t.id] = v; });
    return m;
  }

  // ---------- difficulty picker ----------
  function renderDiffPickers() {
    document.querySelectorAll('.diff-slot').forEach((slot) => {
      const compact = slot.classList.contains('compact');
      slot.innerHTML = '';
      const group = document.createElement('div');
      group.className = 'diff-picker';
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', 'Difficulty');
      Q.DIFFICULTIES.forEach((d) => {
        const b = document.createElement('button');
        const active = d.id === stats.difficulty;
        b.className = 'diff-opt diff-' + d.id + (active ? ' active' : '');
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(active));
        b.setAttribute('aria-label', d.name);
        b.title = d.name;
        b.innerHTML = `<span class="diff-icon">${d.icon}</span><span class="diff-name">${d.name}</span>`;
        b.addEventListener('click', () => setDifficulty(d.id));
        group.appendChild(b);
      });
      slot.appendChild(group);
      if (!compact) {
        const p = document.createElement('p');
        p.className = 'diff-blurb muted small';
        p.textContent = diff().blurb + (diff().xpMult > 1 ? ` XP ×${diff().xpMult}.` : '');
        slot.appendChild(p);
      }
    });
  }

  function setDifficulty(id) {
    if (id === stats.difficulty) return;
    stats.difficulty = id;
    save();
    renderDiffPickers();
    lab.setMode(id, stats.lab.levels[id] || 1);
  }

  // ---------- views ----------
  const TAB_FOR_VIEW = { quiz: 'topics', summary: 'topics' };

  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    const tab = TAB_FOR_VIEW[name] || name;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === tab));
    if (name === 'home') renderHome();
    if (name === 'topics') renderTopics();
    if (name === 'progress') renderProgress();
    if (name === 'lab') lab.resize();
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => {
      const leave = () => { stopTimer(); quiz = null; showView(b.dataset.view); };
      if (quiz && !quiz.done) askConfirm('Leave this round? The answers you already gave are saved.', 'Leave round', leave);
      else leave();
    })
  );

  // In-page confirmation (native confirm() dialogs are blocked in some hosts).
  let confirmAction = null;
  function askConfirm(message, yesLabel, onYes) {
    $('confirm-msg').textContent = message;
    $('confirm-yes').textContent = yesLabel;
    confirmAction = onYes;
    $('confirm').hidden = false;
    $('confirm-no').focus();
  }
  function closeConfirm(run) {
    const action = confirmAction;
    confirmAction = null;
    $('confirm').hidden = true;
    if (run && action) action();
  }
  $('confirm-yes').addEventListener('click', () => closeConfirm(true));
  $('confirm-no').addEventListener('click', () => closeConfirm(false));
  $('confirm').addEventListener('click', (e) => { if (e.target === $('confirm')) closeConfirm(false); });

  function renderHud() {
    const li = levelInfo(stats.xp);
    $('hud-level').textContent = li.level;
    $('hud-days').textContent = currentDayStreak();
    $('hud-xpfill').style.width = (100 * li.into / li.need) + '%';
    $('hud-xpfill').parentElement.title = `${li.into} / ${li.need} XP to level ${li.level + 1}`;
  }

  function masteryLabel(m) {
    if (m === null) return 'Not started';
    if (m < 0.4) return 'Needs work';
    if (m < 0.75) return 'Getting there';
    return 'Strong';
  }

  function weakestTopic() {
    let worst = null;
    Q.TOPICS.forEach((t) => {
      const m = mastery(t.id);
      if (m !== null && (worst === null || m < worst.m)) worst = { t, m };
    });
    return worst;
  }

  function renderHome() {
    const count = todayCount();
    $('goal-count').textContent = count;
    $('goal-target').textContent = stats.goal;
    $('goal-fill').style.width = Math.min(100, (100 * count) / stats.goal) + '%';
    $('greeting').textContent = count >= stats.goal
      ? "🏆 Daily goal done! You're on fire!"
      : stats.answered === 0 ? 'Ready to level up your physics?' : 'Welcome back! Keep the streak going.';
    $('home-xp').textContent = stats.xp;
    $('home-acc').textContent = stats.answered ? Math.round((100 * stats.correct) / stats.answered) + '%' : '–';
    $('home-best').textContent = stats.bestStreak;
    const w = weakestTopic();
    $('home-weak').textContent = w ? w.t.icon + ' ' + w.t.name : '–';
  }

  function renderTopics() {
    const grid = $('topic-grid');
    grid.innerHTML = '';
    const smart = document.createElement('button');
    smart.className = 'card topic smart';
    smart.innerHTML = `<span class="topic-icon">🧠</span><b>Smart Mix</b><span class="muted small">All topics, with more questions from your weakest ones</span>`;
    smart.addEventListener('click', () => startQuiz('smart'));
    grid.appendChild(smart);
    Q.TOPICS.forEach((t) => {
      const m = mastery(t.id);
      const b = document.createElement('button');
      b.className = 'card topic';
      b.innerHTML = `<span class="topic-icon">${t.icon}</span><b>${t.name}</b><span class="muted small">${t.blurb}</span>
        <div class="bar thin"><div style="width:${m === null ? 0 : Math.round(m * 100)}%"></div></div>
        <span class="small muted">${masteryLabel(m)}${m === null ? '' : ' · ' + Math.round(m * 100) + '%'}</span>`;
      b.addEventListener('click', () => startQuiz(t.id));
      grid.appendChild(b);
    });
  }

  function renderFormulas() {
    const grid = $('formula-grid');
    Q.TOPICS.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h3>${t.icon} ${t.name}</h3>` +
        Q.FORMULAS[t.id].map(([f, d]) => `<div class="formula"><code>${f}</code><span class="muted small">${d}</span></div>`).join('');
      grid.appendChild(card);
    });
  }

  function renderProgress() {
    const li = levelInfo(stats.xp);
    $('pr-level').textContent = li.level;
    $('pr-title').textContent = li.title;
    $('pr-answered').textContent = stats.answered;
    $('pr-days').textContent = currentDayStreak();
    $('pr-bestdays').textContent = stats.bestDayStreak;
    $('pr-lab').textContent = stats.lab.hits;
    $('set-goal').value = String(stats.goal);
    $('best-list').innerHTML = Q.DIFFICULTIES.map((d) => {
      const b = stats.best[d.id];
      return `<div class="best diff-${d.id}"><span>${d.icon} ${d.name}</span><b>${b ? b.score + ' / ' + b.of : '–'}</b></div>`;
    }).join('');
    $('mastery-list').innerHTML = Q.TOPICS.map((t) => {
      const m = mastery(t.id);
      const s = stats.topics[t.id];
      const pct = m === null ? 0 : Math.round(m * 100);
      const tone = m === null ? '' : m < 0.4 ? 'bad' : m < 0.75 ? 'mid' : 'good';
      return `<div class="mastery">
        <span>${t.icon} ${t.name}</span>
        <div class="bar ${tone}"><div style="width:${pct}%"></div></div>
        <span class="small muted">${m === null ? 'not started' : pct + '% · ' + s.attempts + ' answered'}</span>
      </div>`;
    }).join('');
  }

  $('set-goal').addEventListener('change', (e) => { stats.goal = +e.target.value; save(); renderHome(); });
  $('reset').addEventListener('click', () => {
    askConfirm('Reset all progress? Your XP, streaks and mastery will be erased. This cannot be undone.', 'Reset everything', () => {
      const keep = stats.difficulty;
      stats = freshStats();
      stats.difficulty = keep;
      save();
      renderHud();
      renderProgress();
      lab.setMode(keep, 1);
      toast('Progress reset. Fresh start!');
    });
  });

  // ---------- quiz ----------
  let quiz = null;

  function startQuiz(mode) {
    const d = diff();
    quiz = {
      mode, diff: d, index: 0, score: 0, streak: 0, xp: 0, log: [], prompts: new Set(),
      current: null, answered: false, done: false, peeked: false,
      lives: d.lives || null, timerId: null, deadline: 0,
    };
    showView('quiz');
    nextQuestion();
  }

  function renderLives() {
    const el = $('quiz-lives');
    if (!quiz.diff.lives) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = '❤️'.repeat(quiz.lives) + '🖤'.repeat(quiz.diff.lives - quiz.lives);
  }

  function nextQuestion() {
    if (quiz.index >= ROUND_LENGTH) return finishQuiz();
    const d = quiz.diff;
    let q;
    for (let tries = 0; tries < 8; tries++) {
      const topic = quiz.mode === 'smart' ? Q.pickWeightedTopic(accuracyMap()) : quiz.mode;
      q = Q.generate(topic, d.id);
      if (!quiz.prompts.has(q.prompt)) break;
    }
    quiz.prompts.add(q.prompt);
    quiz.current = q;
    quiz.answered = false;
    quiz.peeked = false;

    const t = topicById[q.topic];
    $('q-topic').textContent = `${d.icon} ${d.name} · ${t.icon} ${t.name} · ${q.kind === 'concept' ? 'concept' : 'calculation'}`;
    $('q-prompt').textContent = q.prompt;
    $('quiz-count').textContent = `${quiz.index + 1} / ${ROUND_LENGTH}`;
    $('quiz-fill').style.width = (100 * quiz.index) / ROUND_LENGTH + '%';
    $('quiz-streak').textContent = '🔥 ' + quiz.streak;
    $('q-feedback').hidden = true;
    $('q-next').hidden = true;
    renderLives();

    // formula help
    const hasFormula = q.kind !== 'concept' && q.formula;
    $('q-formula').hidden = !(hasFormula && d.formula === 'always');
    $('q-formula').textContent = hasFormula ? '💡 Use: ' + q.formula : '';
    $('q-peek').hidden = !(hasFormula && d.formula === 'peek');

    // answer area
    const box = $('q-choices');
    box.innerHTML = '';
    const isTyped = q.kind === 'typed';
    box.hidden = isTyped;
    $('q-typed').hidden = !isTyped;
    if (isTyped) {
      $('q-input').value = '';
      $('q-input').disabled = false;
      $('q-check').disabled = false;
      $('q-typed').className = 'typed';
      $('q-unit').textContent = q.unit;
      $('q-input').focus();
    } else {
      q.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.innerHTML = `<span class="key">${i + 1}</span><span></span>`;
        b.lastChild.textContent = c;
        b.addEventListener('click', () => answer(i));
        box.appendChild(b);
      });
    }
    $('quiz-tip').textContent = isTyped
      ? 'Type the number and press Enter. The unit is already filled in.'
      : 'Tip: press 1–4 to answer, Enter for the next question.' + (d.g === 10 ? ' Beginner uses g = 10 m/s².' : '');

    startTimer();
  }

  // ---------- timer ----------
  function startTimer() {
    stopTimer();
    const secs = quiz.diff.timer;
    $('quiz-timer').hidden = !secs;
    if (!secs) return;
    quiz.deadline = performance.now() + secs * 1000;
    quiz.timerId = setInterval(tick, 100);
    tick();
  }
  function stopTimer() {
    if (quiz && quiz.timerId) { clearInterval(quiz.timerId); quiz.timerId = null; }
  }
  function timeLeftFraction() {
    if (!quiz.diff.timer) return 0;
    return Math.max(0, quiz.deadline - performance.now()) / (quiz.diff.timer * 1000);
  }
  function tick() {
    if (!quiz || quiz.answered) return stopTimer();
    const frac = timeLeftFraction();
    const secs = Math.ceil(frac * quiz.diff.timer);
    $('quiz-timer-fill').style.width = frac * 100 + '%';
    $('quiz-timer-text').textContent = '⏱ ' + secs + ' s';
    $('quiz-timer').classList.toggle('low', secs <= 10);
    if (frac <= 0) resolve(false, '⏱ Out of time', { timeout: true });
  }

  // ---------- answering ----------
  function answer(i) {
    if (!quiz || quiz.answered || quiz.current.kind === 'typed') return;
    const q = quiz.current;
    resolve(i === q.correctIndex, q.choices[i], { choiceIndex: i });
  }

  $('q-typed').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!quiz || quiz.answered) return;
    const text = $('q-input').value.trim();
    if (!text) { $('q-input').focus(); return; }
    if (!isFinite(Q.parseAnswer(text))) {
      toast('Type a number, like 12.5 or 4.5e19');
      $('q-input').focus();
      return;
    }
    const q = quiz.current;
    resolve(Q.checkTyped(q, text), text + (q.unit ? ' ' + q.unit : ''), {});
  });

  $('q-peek').addEventListener('click', () => {
    if (!quiz || quiz.answered) return;
    quiz.peeked = true;
    $('q-peek').hidden = true;
    $('q-formula').hidden = false;
  });

  function resolve(ok, chosenText, opts) {
    const q = quiz.current;
    const d = quiz.diff;
    const frac = timeLeftFraction();
    quiz.answered = true;
    stopTimer();

    if (q.kind === 'typed') {
      $('q-input').disabled = true;
      $('q-check').disabled = true;
      $('q-typed').className = 'typed ' + (ok ? 'correct' : 'wrong');
    } else {
      const buttons = $('q-choices').children;
      for (let k = 0; k < buttons.length; k++) {
        buttons[k].disabled = true;
        if (k === q.correctIndex) buttons[k].classList.add('correct');
        else if (k === opts.choiceIndex) buttons[k].classList.add('wrong');
      }
    }

    // record stats
    touchDay();
    stats.todayCount++;
    stats.answered++;
    const ts = stats.topics[q.topic];
    ts.attempts++;
    ts.recent.push(ok);
    if (ts.recent.length > 20) ts.recent.shift();

    let gained = 0, speedBonus = 0;
    if (ok) {
      quiz.score++;
      quiz.streak++;
      stats.correct++;
      ts.correct++;
      stats.bestStreak = Math.max(stats.bestStreak, quiz.streak);
      speedBonus = d.timer ? Math.round(5 * frac) : 0;
      const base = 10 + Math.min(quiz.streak - 1, 5) * 2 + speedBonus;
      gained = Math.round(base * d.xpMult * (quiz.peeked ? 0.5 : 1));
      quiz.xp += gained;
      addXp(gained);
    } else {
      quiz.streak = 0;
      if (d.lives) quiz.lives--;
    }
    if (todayCount() === stats.goal) toast('🏆 Daily goal reached! Great work.');
    save();
    renderHud();
    renderLives();

    quiz.log.push({ q, chosenText, ok });
    const fb = $('q-feedback');
    fb.hidden = false;
    fb.className = 'feedback ' + (ok ? 'good' : 'bad');
    fb.innerHTML = '';
    const head = document.createElement('div');
    if (ok) {
      head.innerHTML = `<b>✅ Correct!</b> +${gained} XP` +
        (speedBonus ? ` <span class="small">(⚡ speed bonus)</span>` : '') +
        (quiz.peeked ? ` <span class="small">(half XP for peeking)</span>` : '') +
        (quiz.streak >= 3 ? ` · 🔥 ${quiz.streak} in a row!` : '');
    } else {
      head.innerHTML = `<b>${opts.timeout ? "⏱ Time's up!" : '❌ Not quite.'}</b> The answer is <b class="ans"></b>.`;
      head.querySelector('.ans').textContent = q.answerText;
      if (q.kind === 'typed' && !opts.timeout) {
        const yours = document.createElement('div');
        yours.className = 'small';
        yours.textContent = `You typed ${chosenText}.`;
        head.appendChild(yours);
      }
    }
    fb.appendChild(head);
    const p = document.createElement('p');
    p.textContent = q.explanation;
    fb.appendChild(p);
    if (quiz.lives === 0) {
      const over = document.createElement('p');
      over.innerHTML = '<b>💀 Out of lives!</b>';
      fb.appendChild(over);
    }

    $('quiz-streak').textContent = '🔥 ' + quiz.streak;
    $('q-next').hidden = false;
    $('q-next').textContent = quiz.index + 1 >= ROUND_LENGTH || quiz.lives === 0 ? 'See results ➜' : 'Next ➜';
    $('q-next').focus();
  }

  $('q-next').addEventListener('click', () => {
    if (quiz.lives === 0) return finishQuiz();
    quiz.index++;
    nextQuestion();
  });
  $('quiz-quit').addEventListener('click', () => {
    stopTimer();
    if (quiz.index > 0 || quiz.answered) finishQuiz();
    else { quiz = null; showView('topics'); }
  });

  function finishQuiz() {
    stopTimer();
    quiz.done = true;
    const d = quiz.diff;
    const answered = quiz.log.length;
    const pct = answered ? quiz.score / answered : 0;
    const gameOver = quiz.lives === 0;
    const perfect = answered === ROUND_LENGTH && quiz.score === ROUND_LENGTH;
    if (perfect) {
      const bonus = Math.round(25 * d.xpMult);
      addXp(bonus);
      quiz.xp += bonus;
      toast(`💯 Perfect round! +${bonus} bonus XP`);
    }
    if (answered) {
      const prev = stats.best[d.id];
      if (!prev || quiz.score > prev.score) {
        stats.best[d.id] = { score: quiz.score, of: ROUND_LENGTH };
        if (prev && !perfect) toast(`🏅 New best on ${d.name}: ${quiz.score} / ${ROUND_LENGTH}`);
      }
    }
    save();
    renderHud();

    $('sum-emoji').textContent = gameOver ? '💀' : pct === 1 ? '🏆' : pct >= 0.7 ? '🎉' : pct >= 0.4 ? '💪' : '📖';
    $('sum-title').textContent = gameOver ? 'Out of lives!'
      : pct === 1 ? 'Perfect round!' : pct >= 0.7 ? 'Great job!' : pct >= 0.4 ? 'Good effort. Keep going!' : 'Every mistake is a lesson!';
    $('sum-diff').textContent = `${d.icon} ${d.name}` + (gameOver ? ` · survived ${answered} question${answered === 1 ? '' : 's'}` : '');
    $('sum-score').textContent = quiz.score;
    $('sum-total').textContent = answered;
    $('sum-xp').textContent = quiz.xp;

    const review = $('sum-review');
    review.innerHTML = '';
    const missed = quiz.log.filter((l) => !l.ok);
    if (missed.length) {
      const h = document.createElement('h3');
      h.textContent = `Review your ${missed.length} missed question${missed.length > 1 ? 's' : ''}`;
      review.appendChild(h);
      missed.forEach((l) => {
        const card = document.createElement('div');
        card.className = 'card review';
        card.innerHTML = '<p class="q-prompt"></p><p class="small"><span class="tag bad">You said</span> <span></span></p><p class="small"><span class="tag good">Answer</span> <span></span></p><p class="muted small"></p>';
        const ps = card.querySelectorAll('p');
        ps[0].textContent = l.q.prompt;
        ps[1].lastChild.textContent = l.chosenText;
        ps[2].lastChild.textContent = l.q.answerText;
        ps[3].textContent = l.q.explanation;
        review.appendChild(card);
      });
    }
    showView('summary');
  }

  $('sum-again').addEventListener('click', () => startQuiz(quiz.mode));
  $('sum-topics').addEventListener('click', () => { quiz = null; showView('topics'); });

  document.addEventListener('keydown', (e) => {
    if (!$('confirm').hidden) { if (e.key === 'Escape') closeConfirm(false); return; }
    if (!quiz || quiz.done || !$('view-quiz').classList.contains('active')) return;
    if (!quiz.answered && quiz.current.kind !== 'typed' && /^[1-4]$/.test(e.key)) answer(+e.key - 1);
    else if (quiz.answered && e.key === 'Enter' && document.activeElement !== $('q-next')) {
      e.preventDefault();
      $('q-next').click();
    }
  });

  // ---------- home buttons ----------
  $('btn-smart').addEventListener('click', () => startQuiz('smart'));
  $('btn-lab').addEventListener('click', () => showView('lab'));

  // ---------- toast ----------
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3000);
  }

  // ---------- projectile lab ----------
  const lab = window.ProjectileLab.create({
    canvas: $('lab-canvas'),
    mode: stats.difficulty,
    startLevel: stats.lab.levels[stats.difficulty] || 1,
    elements: {
      angle: $('lab-angle'), speed: $('lab-speed'),
      angleOut: $('lab-angle-out'), speedOut: $('lab-speed-out'),
      fire: $('lab-fire'), hint: $('lab-hint'), next: $('lab-next'),
      message: $('lab-message'), level: $('lab-level'), shots: $('lab-shots'),
      nudges: document.querySelectorAll('.nudge'),
    },
    onScore(r) {
      stats.lab.shots++;
      if (r.hit) {
        const gained = Math.round(r.xp * Q.DIFF[r.mode].xpMult);
        touchDay();
        stats.lab.hits++;
        stats.lab.levels[r.mode] = r.level + 1;
        addXp(gained);
        r.done(gained);
        if (r.mode === 'medium' && r.level + 1 === 3) toast('🧱 Walls unlocked! Now you need to clear an obstacle.');
      }
      save();
      renderHud();
    },
  });

  // ---------- boot ----------
  renderFormulas();
  renderDiffPickers();
  renderHud();
  showView('home');
})();
